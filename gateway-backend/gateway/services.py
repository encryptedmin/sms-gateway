import os
import re
import threading
import time
from contextlib import contextmanager

import serial
from serial.tools import list_ports

from django.conf import settings


class Sim800Service:

    RESPONSE_TIMEOUT = 30
    SMS_RESPONSE_SETTLE_TIME = 2
    MODEM_LOCK_TIMEOUT = 120
    MODEM_THREAD_LOCK = threading.Lock()

    def __init__(self):

        self.preferred_ports = self._get_preferred_ports()
        self.baudrate = settings.SMS_MODEM_BAUDRATE

    def _get_preferred_ports(self):

        ports = getattr(
            settings,
            "SMS_MODEM_PORTS",
            None
        )

        if ports is None:

            ports = [
                getattr(
                    settings,
                    "SMS_MODEM_PORT",
                    "COM3"
                )
            ]

        if isinstance(ports, str):

            ports = [
                port.strip()
                for port in ports.split(",")
            ]

        return [
            port
            for port in ports
            if port
        ]

    def _available_ports(self):

        return [
            port.device
            for port in list_ports.comports()
        ]

    def _candidate_ports(self):

        available_ports = self._available_ports()

        preferred_available = [
            port
            for port in self.preferred_ports
            if port in available_ports
        ]

        other_available = [
            port
            for port in available_ports
            if port not in preferred_available
        ]

        if preferred_available or other_available:

            return preferred_available + other_available

        return self.preferred_ports

    def _connect_modem(self):

        candidate_ports = self._candidate_ports()
        failures = []

        for port in candidate_ports:

            ser = None

            try:

                ser = serial.Serial(
                    port=port,
                    baudrate=self.baudrate,
                    timeout=1
                )

                time.sleep(1)

                response = self._send_command(
                    ser,
                    "AT",
                    timeout=5
                )

                if "OK" in response:

                    response = self._send_command(
                        ser,
                        "ATE0"
                    )

                    if "OK" not in response:

                        failures.append(
                            f"{port}: ATE0 failed: {response}"
                        )

                        continue

                    response = self._send_command(
                        ser,
                        "AT+CREG?"
                    )

                    if not self._is_registered(response):

                        failures.append(
                            f"{port}: modem not registered: {response}"
                        )

                        continue

                    response = self._send_command(
                        ser,
                        "AT+CMGF=1"
                    )

                    if "OK" not in response:

                        failures.append(
                            f"{port}: SMS text mode failed: {response}"
                        )

                        continue

                    modem = ser
                    ser = None
                    return modem

                failures.append(
                    f"{port}: {response}"
                )

            except Exception as ex:

                failures.append(
                    f"{port}: {ex}"
                )

            finally:

                if ser and ser.is_open:

                    ser.close()

        if not candidate_ports:

            raise RuntimeError(
                "No serial ports detected"
            )

        raise RuntimeError(
            "No responsive SMS modem found. Tried: "
            + "; ".join(failures)
        )

    @contextmanager
    def _modem_lock(
        self,
        timeout=None
    ):

        lock_timeout = timeout or self.MODEM_LOCK_TIMEOUT
        lock_path = os.path.join(
            settings.BASE_DIR,
            "sim800.lock"
        )

        lock_file = open(
            lock_path,
            "a+b"
        )

        thread_locked = False
        locked = False
        start = time.time()

        try:

            thread_locked = self.MODEM_THREAD_LOCK.acquire(
                timeout=lock_timeout
            )

            if not thread_locked:

                raise TimeoutError(
                    "Timed out waiting for modem thread lock"
                )

            while time.time() - start < lock_timeout:

                try:

                    lock_file.seek(0)
                    lock_file.write(b"0")
                    lock_file.flush()
                    lock_file.seek(0)

                    if os.name == "nt":

                        import msvcrt

                        msvcrt.locking(
                            lock_file.fileno(),
                            msvcrt.LK_NBLCK,
                            1
                        )

                    else:

                        import fcntl

                        fcntl.flock(
                            lock_file.fileno(),
                            fcntl.LOCK_EX | fcntl.LOCK_NB
                        )

                    locked = True
                    break

                except OSError:

                    time.sleep(0.25)

            if not locked:

                raise TimeoutError(
                    "Timed out waiting for modem lock"
                )

            yield

        finally:

            if locked:

                lock_file.seek(0)

                if os.name == "nt":

                    import msvcrt

                    msvcrt.locking(
                        lock_file.fileno(),
                        msvcrt.LK_UNLCK,
                        1
                    )

                else:

                    import fcntl

                    fcntl.flock(
                        lock_file.fileno(),
                        fcntl.LOCK_UN
                    )

            lock_file.close()

            if thread_locked:

                self.MODEM_THREAD_LOCK.release()

    def _read_until(
        self,
        ser,
        expected=None,
        timeout=10
    ):

        buffer = b""

        start = time.time()

        while time.time() - start < timeout:

            waiting = ser.in_waiting

            if waiting:

                buffer += ser.read(waiting)

                decoded = buffer.decode(
                    errors="replace"
                )

                if expected:

                    if (
                        expected in decoded
                        or "+CMS ERROR" in decoded
                        or "ERROR" in decoded
                    ):
                        return decoded

                else:

                    if (
                        "OK" in decoded
                        or "ERROR" in decoded
                        or "+CMS ERROR" in decoded
                    ):
                        return decoded

            time.sleep(0.1)

        decoded = buffer.decode(
            errors="replace"
        )

        if decoded:
            return decoded

        if expected:
            return (
                "TIMEOUT waiting for "
                + expected
            )

        return "TIMEOUT waiting for modem response"

    def _read_sms_response(
        self,
        ser,
        timeout=None
    ):

        buffer = b""
        start = time.time()
        deadline = start + (timeout or self.RESPONSE_TIMEOUT)
        cmgs_seen = False
        settle_deadline = None

        while time.time() < deadline:

            waiting = ser.in_waiting

            if waiting:

                buffer += ser.read(waiting)

                decoded = buffer.decode(
                    errors="replace"
                )

                if (
                    "+CMS ERROR" in decoded
                    or "ERROR" in decoded
                ):
                    return decoded

                if "+CMGS:" in decoded:

                    cmgs_seen = True

                    if "OK" in decoded:
                        return decoded

                    settle_deadline = (
                        time.time()
                        + self.SMS_RESPONSE_SETTLE_TIME
                    )

            if (
                cmgs_seen
                and settle_deadline
                and time.time() >= settle_deadline
            ):
                return buffer.decode(
                    errors="replace"
                )

            time.sleep(0.1)

        decoded = buffer.decode(
            errors="replace"
        )

        if decoded:
            return decoded

        return "TIMEOUT waiting for SMS submit response"

    def _is_registered(
        self,
        response
    ):

        match = re.search(
            r"\+CREG:\s*\d+\s*,\s*([0-9])",
            response
        )

        if not match:
            return False

        return match.group(1) in (
            "1",
            "5"
        )

    def _send_command(
        self,
        ser,
        command,
        expected="OK",
        timeout=10
    ):

        ser.reset_input_buffer()

        ser.write(
            (command + "\r").encode()
        )

        response = self._read_until(
            ser,
            expected=expected,
            timeout=timeout
        )

        return response

    def send_sms(
        self,
        phone,
        message
    ):

        if settings.SMS_DEV_MODE:

            return True, "DEV MODE"

        try:

            with self._modem_lock():

                ser = self._connect_modem()

                try:

                    # Recipient

                    ser.reset_input_buffer()

                    ser.write(
                        f'AT+CMGS="{phone}"\r'.encode()
                    )

                    prompt = self._read_until(
                        ser,
                        expected=">",
                        timeout=10
                    )

                    if ">" not in prompt:

                        return False, prompt

                    # Message body

                    ser.write(
                        message.encode()
                    )

                    ser.write(
                        bytes([26])
                    )

                    result = self._read_sms_response(
                        ser,
                        timeout=self.RESPONSE_TIMEOUT
                    )

                    if "+CMGS:" in result:
                        return True, result

                    return False, result

                finally:

                    if ser and ser.is_open:

                        ser.close()

        except Exception as ex:

            return False, str(ex)
