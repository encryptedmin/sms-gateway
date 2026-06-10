import serial
import time
from serial.tools import list_ports

PHONE = "09090807689"

MESSAGE = "Hello from SIM800C via Python"

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
                timeout=5
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

    def send(cmd, wait=1):
        ser.write((cmd + "\r").encode())
        time.sleep(wait)
        response = ser.read_all().decode(
            errors="ignore"
        )
        print(response)
        return response

    print("TEXT MODE")

    send("AT")

    send("ATE0")

    send("AT+CMGF=1")

    print("SETTING RECIPIENT")

    ser.write(
        f'AT+CMGS="{PHONE}"\r'.encode()
    )

    time.sleep(2)

    print(
        ser.read_all().decode(
            errors="ignore"
        )
    )

    print("SENDING MESSAGE")

    ser.write(
        MESSAGE.encode()
    )

    time.sleep(1)

    ser.write(bytes([26]))

    time.sleep(10)

    print(
        ser.read_all().decode(
            errors="ignore"
        )
    )

    ser.close()


if __name__ == "__main__":
    main()
