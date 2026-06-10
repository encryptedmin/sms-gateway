import serial
import time
from serial.tools import list_ports

PREFERRED_PORTS = [
    "COM3",
    "COM4",
]

BAUDRATE = 115200


def candidate_ports():

    available_ports = [
        port.device
        for port in list_ports.comports()
    ]

    preferred_available = [
        port
        for port in PREFERRED_PORTS
        if port in available_ports
    ]

    other_available = [
        port
        for port in available_ports
        if port not in preferred_available
    ]

    return preferred_available + other_available


def connect_modem():

    failures = []

    for port in candidate_ports():

        ser = None

        try:

            ser = serial.Serial(
                port=port,
                baudrate=BAUDRATE,
                timeout=2
            )

            time.sleep(1)

            ser.write(b"AT\r")

            time.sleep(1)

            response = ser.read_all().decode(
                errors="ignore"
            )

            if "OK" in response:

                print(f"Using modem on {port}")

                modem = ser
                ser = None
                return modem

            failures.append(f"{port}: {response}")

        except Exception as ex:

            failures.append(f"{port}: {ex}")

        finally:

            if ser and ser.is_open:

                ser.close()

    raise RuntimeError(
        "No responsive modem found. Tried: "
        + "; ".join(failures)
    )


def main():

    ser = connect_modem()

    time.sleep(2)

    commands = [
        "AT",
        "AT+CPIN?",
        "AT+CSQ",
        "AT+CREG?"
    ]

    for cmd in commands:

        print(f"\n>>> {cmd}")

        ser.write((cmd + "\r").encode())

        time.sleep(1)

        print(
            ser.read_all().decode(
                errors="ignore"
            )
        )

    ser.close()


if __name__ == "__main__":
    main()
