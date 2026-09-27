"""
Shared phone number validation for anything that can end up as a
Contact.mobile_number or an outbound SmsLog.recipient.

Why this exists: gateway.services.Sim800Service.send_sms interpolates
the recipient directly into a modem AT command with no further
escaping:

    ser.write(f'AT+CMGS="{phone}"\r'.encode())

A value containing a double quote or a carriage return could break out
of that command and inject arbitrary AT commands into the modem
session. Every entry point that can produce a value that eventually
reaches that line (contact creation/import, direct API sends) must
normalize through normalize_phone_number() first, so services.py never
sees anything but digits and a leading '+'.
"""

import re

PHONE_NUMBER_MIN_DIGITS = 7
PHONE_NUMBER_MAX_DIGITS = 15

# Formatting characters we tolerate in raw user input and strip out:
# spaces, hyphens, parentheses, dots. Anything else (letters, quotes,
# control characters, etc.) fails validation rather than being silently
# stripped, so we don't mask typos or, worse, quietly "sanitize" an
# injection attempt into something that still validates.
_STRIP_CHARS_RE = re.compile(r"[\s\-().]")

_PHONE_RE = re.compile(
    rf"^\+?[0-9]{{{PHONE_NUMBER_MIN_DIGITS},{PHONE_NUMBER_MAX_DIGITS}}}$"
)

PHONE_NUMBER_ERROR_MESSAGE = (
    "Enter a valid phone number: digits only, optionally starting with "
    "'+', {min}-{max} digits long.".format(
        min=PHONE_NUMBER_MIN_DIGITS,
        max=PHONE_NUMBER_MAX_DIGITS,
    )
)


def normalize_phone_number(raw):
    """
    Strips common formatting characters (spaces, hyphens, parens, dots)
    then validates that what's left is only digits with an optional
    leading '+', between PHONE_NUMBER_MIN_DIGITS and
    PHONE_NUMBER_MAX_DIGITS long.

    Returns the normalized string on success.
    Raises ValueError (with a user-facing message) on invalid input.
    """

    if raw is None:
        raise ValueError("Phone number is required.")

    candidate = _STRIP_CHARS_RE.sub("", str(raw).strip())

    if not _PHONE_RE.match(candidate):
        raise ValueError(PHONE_NUMBER_ERROR_MESSAGE)

    return candidate
