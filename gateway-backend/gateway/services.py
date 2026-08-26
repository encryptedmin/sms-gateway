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
    PORT_LOCK_ACQUIRE_TIMEOUT = 15

    # Per-port locks, keyed by port name (e.g. "COM3"). Guarding the dict
    # itself with a small lock so two threads creating a lock for the
    # same new port at the same instant can't create two different
    # Lock objects for it.
    _PORT_LOCKS_GUARD = threading.Lock()
    _PORT_THREAD_LOCKS = {}

    def __init__(self, port=None):
        """
        port: a specific COM port (e.g. "COM3") this instance should use.
        Passed in by process_sms once it has decided, via round robin,
        which modem should handle a given message. When omitted, this
        instance falls back to trying every configured/detected port in
        order — used by manual/CLI testing where there's no dispatcher
        assigning a port ahead of time.
        """

        self.port = port
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

    def detected_ports(self):
        """
        Which of the configured SMS_MODEM_PORTS are actually plugged in
        right now. Used by the round-robin dispatcher to only rotate
        across modems that are physically present.
        """

        available = self._available_ports()

        return [
            port
            for port in self.preferred_ports
            if port in available
        ]

    def _candidate_ports(self):

        available_ports = self._available_ports()

        if self.port:

            # A specific modem was assigned to this send. Prefer it
            # strongly, but still allow falling back to another
            # configured+detected modem if the assigned one has gone
            # missing (unplugged, driver hiccup, etc.) rather than
            # failing outright.

            fallback_ports = [
                port
                for port in self.preferred_ports
                if port in available_ports
                and port != self.port
            ]

            return [self.port] + fallback_ports

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

    @classmethod
    def _thread_lock_for(cls, port):

        with cls._PORT_LOCKS_GUARD:

            if port not in cls._PORT_THREAD_LOCKS:
                cls._PORT_THREAD_LOCKS[port] = threading.Lock()

            return cls._PORT_THREAD_LOCKS[port]

    def _lock_file_path(self, port):

        safe_name = re.sub(
            r"[^A-Za-z0-9]+",
            "_",
            port
        )

        return os.path.join(
            settings.BASE_DIR,
            f"sim800_{safe_name}.lock"
        )

    def _connect_single_port(self, port):
        """
        Brings up exactly one port and leaves it ready for AT+CMGS.
        Raises RuntimeError with a descriptive message on any failure.
        Caller is responsible for closing the returned serial.Serial.
        """

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

            if "OK" not in response:
                raise RuntimeError(response)

            response = self._send_command(
                ser,
                "ATE0"
            )

            if "OK" not in response:
                raise RuntimeError(f"ATE0 failed: {response}")

            response = self._send_command(
                ser,
                "AT+CREG?"
            )

            if not self._is_registered(response):
                raise RuntimeError(f"modem not registered: {response}")

            response = self._send_command(
                ser,
                "AT+CMGF=1"
            )

            if "OK" not in response:
                raise RuntimeError(f"SMS text mode failed: {response}")

            modem = ser
            ser = None
            return modem

        except Exception as ex:

            raise RuntimeError(f"{port}: {ex}") from ex

        finally:

            if ser and ser.is_open:
                ser.close()

    @contextmanager
    def _modem_lock(
        self,
        port,
        timeout=None
    ):

        lock_timeout = timeout or self.MODEM_LOCK_TIMEOUT
        lock_path = self._lock_file_path(port)
        thread_lock = self._thread_lock_for(port)

        lock_file = open(
            lock_path,
            "a+b"
        )

        thread_locked = False
        locked = False
        start = time.time()

        try:

            thread_locked = thread_lock.acquire(
                timeout=lock_timeout
            )

            if not thread_locked:

                raise TimeoutError(
                    f"Timed out waiting for {port} thread lock"
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
                    f"Timed out waiting for {port} modem lock"
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

                thread_lock.release()

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

            return True, "DEV MODE", (self.port or "DEV")

        candidate_ports = self._candidate_ports()

        if not candidate_ports:

            return False, "No serial ports detected", ""

        failures = []

        for port in candidate_ports:

            try:

                with self._modem_lock(
                    port,
                    timeout=self.PORT_LOCK_ACQUIRE_TIMEOUT
                ):

                    ser = None

                    try:

                        ser = self._connect_single_port(
                            port
                        )

                    except Exception as ex:

                        failures.append(
                            str(ex)
                        )

                        continue

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

                            failures.append(
                                f"{port}: {prompt}"
                            )

                            continue

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
                            return True, result, port

                        failures.append(
                            f"{port}: {result}"
                        )

                        continue

                    except Exception as ex:

                        # e.g. the modem was unplugged mid-send — treat
                        # it the same as any other port-level failure
                        # and let the loop try the next candidate.

                        failures.append(
                            f"{port}: {ex}"
                        )

                        continue

                    finally:

                        if ser and ser.is_open:

                            ser.close()

            except (TimeoutError, OSError) as ex:

                failures.append(
                    str(ex)
                )

                continue

        return (
            False,
            "No responsive SMS modem found. Tried: " + "; ".join(failures),
            ""
        )