import os
import re
import threading
import time
from contextlib import contextmanager

import serial
from serial.tools import list_ports

from django.conf import settings

from .sms_errors import classify_failure
from .sms_errors import describe_registration
from .sms_errors import MODEM_OFFLINE
from .sms_errors import WEAK_OR_NO_SIGNAL


class Sim800Service:

    RESPONSE_TIMEOUT = 30
    SMS_RESPONSE_SETTLE_TIME = 2
    MODEM_LOCK_TIMEOUT = 120
    PORT_LOCK_ACQUIRE_TIMEOUT = 15

    # Short timeout used only for discovery probing — we may be poking
    # at ports that aren't a modem at all (mice, printers, Bluetooth
    # dongles), so each one needs to fail fast rather than eating the
    # full RESPONSE_TIMEOUT before the scan can move on.
    DISCOVERY_PROBE_TIMEOUT = 3

    # What a SIM800/SIM800C/SIM800L's ATI or AT+CGMM response looks
    # like, used to positively confirm "this port is actually a SIM800
    # modem" rather than assuming any device that answers AT is one.
    IDENTITY_MARKERS = (
        "SIM800",
        "SIMCOM",
    )

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
        """
        Ports we currently believe host a SIM800 modem — sourced from
        the last admin-triggered discovery (ModemStatus table), NOT a
        hardcoded port list, since the modem can be plugged into any
        USB port on any machine this gets deployed to and we can't
        assume COM3/COM4 or any specific number.

        Falls back to "every serial port currently connected" if
        discovery has never been run yet, so sending still works
        (just less precisely targeted) before the first check. In
        SMS_DEV_MODE there's no real hardware to discover, so this
        falls back to the legacy SMS_MODEM_PORTS setting instead, to
        keep local/test runs predictable.
        """

        if settings.SMS_DEV_MODE:
            return self._configured_ports_from_settings()

        from .models import ModemStatus

        known = list(
            ModemStatus.objects.values_list(
                "port",
                flat=True
            )
        )

        if known:
            return known

        return self._available_ports()

    def _configured_ports_from_settings(self):
        """
        The legacy, manually-configured port list (SMS_MODEM_PORTS /
        SMS_MODEM_PORT in settings.py). Only used now as a DEV_MODE
        fallback, since real deployments rely on discovery instead.
        """

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

                # Build a reason worth showing an admin instead of a raw
                # AT-command dump. CSQ (signal) is measured independently
                # of registration, so we pull it here too: a modem that
                # has real signal but still isn't registered points at a
                # SIM/account problem rather than a coverage problem —
                # worth saying explicitly rather than just "offline".

                stat = self._creg_stat_digit(response)
                _, _, reg_detail = describe_registration(stat)

                csq_response = self._send_command(
                    ser,
                    "AT+CSQ"
                )
                signal_csq = self._parse_csq(csq_response)

                if signal_csq:
                    reg_detail += (
                        f" (signal is present — CSQ={signal_csq} — so this "
                        "isn't a coverage problem; check the SIM/account.)"
                    )

                raise RuntimeError(
                    f"modem not registered: {reg_detail} [raw: {response.strip()}]"
                )

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

    def _creg_stat_digit(
        self,
        response
    ):
        """
        Pulls the <stat> digit out of a raw 'AT+CREG?' response, e.g.
        "+CREG: 0,1" -> "1". Returns None if the response didn't
        contain a parseable +CREG line at all (modem gave no usable
        reply — different from a genuine "0"/"not searching" status).
        """

        match = re.search(
            r"\+CREG:\s*\d+\s*,\s*([0-9])",
            response
        )

        if not match:
            return None

        return match.group(1)

    def _is_registered(
        self,
        response
    ):

        return self._creg_stat_digit(response) in (
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

    def check_status(self, port):
        """
        Lightweight diagnostic probe for one port — online/offline +
        signal quality only. Deliberately skips the SMS-mode setup
        (ATE0, AT+CMGF=1) that a real send needs, since this is meant
        to be quick and cheap: just enough traffic to answer "is this
        modem alive and how's its signal", held under the same
        per-port lock as a real send so the two can never collide.

        Returns a dict:
        {
            "online": bool,
            "signal_csq": int|None,
            "registration_state": str,   # e.g. "SEARCHING", "DENIED"
            "registration_detail": str,  # human explanation, see sms_errors.py
            "raw": str,
        }
        signal_csq is the raw AT+CSQ value (0-31), or None if unknown/
        unreadable (e.g. modem responded but signal query failed).

        Note "online" and "signal_csq" are deliberately independent of
        each other: signal_csq is a raw RF measurement the radio can
        report the moment it powers up, while "online" reflects whether
        the SIM has actually completed network registration (AT+CREG?).
        It's entirely normal — not a bug — for a modem to report a real
        signal_csq while online is False, e.g. mid-registration, or a
        SIM/account problem that blocks registration despite decent
        coverage. registration_state/detail exist specifically to
        surface *which* of those is happening instead of collapsing
        both into a single "Offline".
        """

        if settings.SMS_DEV_MODE:

            return {
                "online": True,
                "signal_csq": 22,
                "registration_state": "REGISTERED_HOME",
                "registration_detail": "Registered on the home network.",
                "raw": "DEV MODE",
            }

        ser = None

        try:

            with self._modem_lock(
                port,
                timeout=self.PORT_LOCK_ACQUIRE_TIMEOUT
            ):

                ser = serial.Serial(
                    port=port,
                    baudrate=self.baudrate,
                    timeout=1
                )

                time.sleep(1)

                at_response = self._send_command(
                    ser,
                    "AT",
                    timeout=5
                )

                if "OK" not in at_response:

                    state, _, detail = describe_registration(None)

                    return {
                        "online": False,
                        "signal_csq": None,
                        "registration_state": "NO_RESPONSE",
                        "registration_detail": (
                            "Modem didn't respond to a basic AT command at "
                            "all — check the cable/USB connection and that "
                            "nothing else has the port open."
                        ),
                        "raw": at_response,
                    }

                creg_response = self._send_command(
                    ser,
                    "AT+CREG?"
                )

                stat = self._creg_stat_digit(creg_response)
                online = stat in ("1", "5")
                reg_state, _, reg_detail = describe_registration(stat)

                csq_response = self._send_command(
                    ser,
                    "AT+CSQ"
                )

                signal_csq = self._parse_csq(csq_response)

                if not online and signal_csq:
                    reg_detail += (
                        f" Signal is present (CSQ={signal_csq}), so this "
                        "isn't a coverage problem — check the SIM/account."
                    )

                return {
                    "online": online,
                    "signal_csq": signal_csq,
                    "registration_state": reg_state,
                    "registration_detail": reg_detail,
                    "raw": f"{creg_response} | {csq_response}",
                }

        except (TimeoutError, OSError) as ex:

            return {
                "online": False,
                "signal_csq": None,
                "registration_state": "NO_RESPONSE",
                "registration_detail": f"Couldn't open/communicate with the port: {ex}",
                "raw": str(ex),
            }

        finally:

            if ser and ser.is_open:

                ser.close()

    def _parse_csq(self, response):

        match = re.search(
            r"\+CSQ:\s*(\d+)\s*,",
            response
        )

        if not match:
            return None

        value = int(match.group(1))

        if value == 99:
            # 99 = "not known or not detectable" per the AT+CSQ spec
            return None

        return value

    def probe_port_identity(self, port):
        """
        Briefly connects to `port` and asks it to identify itself,
        checking whether the response looks like a SIM800/SIMCOM
        module. Deliberately fast and forgiving of failure — this may
        be run against ports that aren't a modem at all (mice,
        printers, Bluetooth dongles, other USB-serial devices), so a
        non-modem port should fail quickly rather than stall a
        whole-system scan.

        Returns True/False. Never raises — any failure just means
        "not a SIM800 on this port", not an error worth surfacing.
        """

        ser = None

        try:

            with self._modem_lock(
                port,
                timeout=self.DISCOVERY_PROBE_TIMEOUT
            ):

                ser = serial.Serial(
                    port=port,
                    baudrate=self.baudrate,
                    timeout=self.DISCOVERY_PROBE_TIMEOUT
                )

                time.sleep(0.3)

                at_response = self._send_command(
                    ser,
                    "AT",
                    timeout=self.DISCOVERY_PROBE_TIMEOUT
                )

                if "OK" not in at_response:
                    return False

                identity_response = self._send_command(
                    ser,
                    "ATI",
                    timeout=self.DISCOVERY_PROBE_TIMEOUT
                )

                if self._looks_like_sim800(identity_response):
                    return True

                # Some SIM800 clones/firmwares don't answer ATI with
                # anything useful — AT+CGMM (get model) is a second,
                # more standardized way to ask the same question.

                model_response = self._send_command(
                    ser,
                    "AT+CGMM",
                    timeout=self.DISCOVERY_PROBE_TIMEOUT
                )

                return self._looks_like_sim800(model_response)

        except (TimeoutError, OSError):

            return False

        finally:

            if ser and ser.is_open:

                ser.close()

    def _looks_like_sim800(self, response):

        upper = response.upper()

        return any(
            marker in upper
            for marker in self.IDENTITY_MARKERS
        )

    def discover_all_modem_ports(self):
        """
        Scans every serial port currently connected to this machine —
        not a preconfigured list — and returns the ones that
        positively identify as a SIM800/SIMCOM modem, regardless of
        which physical USB port or COM number it enumerated as. This
        is what powers the admin's "Check now" action; it's
        deliberately not run on every send (too slow against unrelated
        serial devices) — see gateway/views.py modem_status_check.
        """

        if settings.SMS_DEV_MODE:
            return self._configured_ports_from_settings()

        return [
            port
            for port in self._available_ports()
            if self.probe_port_identity(port)
        ]