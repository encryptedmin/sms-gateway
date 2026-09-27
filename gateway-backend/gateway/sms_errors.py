"""
Translates raw SIM800/SIMCOM modem responses into a (category, human
message) pair so the rest of the system — SmsLog rows, the admin UI,
API responses — can tell someone *why* a message failed instead of
just dumping a raw AT-command transcript at them.

Two things get decoded here:

1. +CMS ERROR / +CME ERROR codes returned by the modem when AT+CMGS
   (send SMS) fails. These are standardized in the GSM specs (07.05,
   03.40, 04.11) — see http://www.developershome.com/sms/resultCodes2.asp
   and the SIM800 Series AT Command Manual — so the mapping below is
   modem-independent GSM behaviour, not a SIM800 quirk.

2. AT+CREG? registration status codes, which explain *why* a modem is
   offline (still searching vs actively denied by the network vs no
   response at all) — this is what separates "no signal yet" from
   "has signal but the SIM/account has a real problem".

Categories are intentionally coarse — they're meant to drive a badge/
filter in the UI and rough triage, not to be a diagnosis. Anything
that hints at a SIM/account/balance problem is phrased as "likely" or
"check", never as a certainty, because the exact same network cause
code is reused by different carriers for different real-world reasons.
"""

import re


# --- Failure categories -----------------------------------------------

MODEM_OFFLINE = "MODEM_OFFLINE"
WEAK_OR_NO_SIGNAL = "WEAK_OR_NO_SIGNAL"
SIM_ERROR = "SIM_ERROR"
BALANCE_OR_BARRED = "BALANCE_OR_BARRED"
NETWORK_REJECTED = "NETWORK_REJECTED"
MESSAGE_REJECTED = "MESSAGE_REJECTED"
STORAGE_FULL = "STORAGE_FULL"
TIMEOUT = "TIMEOUT"
RECIPIENT_BUSY = "RECIPIENT_BUSY"
UNKNOWN = "UNKNOWN"

FAILURE_CATEGORY_CHOICES = [
    (MODEM_OFFLINE, "Modem offline / not registered"),
    (WEAK_OR_NO_SIGNAL, "Weak or no signal"),
    (SIM_ERROR, "SIM card problem"),
    (BALANCE_OR_BARRED, "Likely no credit / barred"),
    (NETWORK_REJECTED, "Rejected by network"),
    (MESSAGE_REJECTED, "Message rejected (format/content)"),
    (STORAGE_FULL, "Modem/SIM storage full"),
    (TIMEOUT, "No response in time"),
    (RECIPIENT_BUSY, "Recipient already being sent to"),
    (UNKNOWN, "Unknown / unclassified"),
]


# --- +CMS ERROR table (GSM 07.05 / 03.40 / 04.11) ----------------------
#
# code -> (category, human message)

_CMS_ERROR_TABLE = {
    1: (NETWORK_REJECTED, "Unassigned/unallocated number — the recipient's number isn't currently in use on the network."),
    8: (BALANCE_OR_BARRED, "Operator determined barring — the carrier has blocked outgoing SMS on this SIM (often a no-credit or account-restriction condition)."),
    10: (BALANCE_OR_BARRED, "Call/SMS barred for this destination — check the SIM's outgoing-SMS barring settings."),
    17: (NETWORK_REJECTED, "Network failure at the carrier's switch."),
    21: (NETWORK_REJECTED, "Short message transfer rejected by the network."),
    22: (NETWORK_REJECTED, "Network congestion — try again shortly."),
    27: (NETWORK_REJECTED, "Destination out of service."),
    28: (NETWORK_REJECTED, "Recipient not registered on the network (unidentified subscriber)."),
    29: (NETWORK_REJECTED, "Requested facility rejected by the network."),
    30: (NETWORK_REJECTED, "Unknown subscriber — the recipient number isn't allocated."),
    38: (NETWORK_REJECTED, "Network out of order — likely to persist, not worth an immediate retry."),
    41: (NETWORK_REJECTED, "Temporary network failure — safe to retry."),
    42: (NETWORK_REJECTED, "Network congestion."),
    47: (NETWORK_REJECTED, "Network resources unavailable."),
    50: (BALANCE_OR_BARRED, "SMS service not provisioned on this SIM/account — check the plan with the carrier."),
    69: (NETWORK_REJECTED, "SMS service not implemented by the network for this destination."),
    81: (NETWORK_REJECTED, "Invalid short message transfer reference."),
    95: (MESSAGE_REJECTED, "Invalid message (unspecified)."),
    96: (MESSAGE_REJECTED, "Invalid or missing mandatory information in the message."),
    97: (MESSAGE_REJECTED, "Message type not recognized by the network."),
    98: (MESSAGE_REJECTED, "Message not valid in the current protocol state."),
    99: (MESSAGE_REJECTED, "Message contains an unrecognized information element."),
    111: (NETWORK_REJECTED, "Protocol error (unspecified) at the network."),
    127: (NETWORK_REJECTED, "Interworking failure with another network — exact cause unavailable."),
    128: (MESSAGE_REJECTED, "Telematic interworking not supported."),
    129: (MESSAGE_REJECTED, "Message type 0 not supported."),
    130: (MESSAGE_REJECTED, "Cannot replace short message."),
    143: (MESSAGE_REJECTED, "Unspecified TP-PID error."),
    144: (MESSAGE_REJECTED, "Data coding scheme not supported."),
    145: (MESSAGE_REJECTED, "Message class not supported."),
    159: (MESSAGE_REJECTED, "Unspecified data-coding-scheme error."),
    160: (MESSAGE_REJECTED, "Command cannot be actioned."),
    161: (MESSAGE_REJECTED, "Command unsupported."),
    175: (MESSAGE_REJECTED, "Unspecified command error."),
    176: (MESSAGE_REJECTED, "TPDU not supported."),
    192: (BALANCE_OR_BARRED, "SMS center busy — often paired with account/subscription issues."),
    193: (BALANCE_OR_BARRED, "No SMS-center subscription for this SIM — likely no active SMS service/credit."),
    194: (NETWORK_REJECTED, "SMS center system failure."),
    195: (MESSAGE_REJECTED, "Invalid SME address."),
    196: (NETWORK_REJECTED, "Destination barred by the SMS center."),
    197: (NETWORK_REJECTED, "Duplicate short message rejected."),
    198: (MESSAGE_REJECTED, "Validity period format not supported."),
    199: (MESSAGE_REJECTED, "Validity period value not supported."),
    208: (STORAGE_FULL, "SIM SMS storage is full — delete stored messages on the SIM."),
    209: (SIM_ERROR, "SIM has no SMS storage capability."),
    210: (SIM_ERROR, "Error in the mobile equipment."),
    211: (STORAGE_FULL, "Memory capacity exceeded."),
    212: (SIM_ERROR, "SIM application toolkit busy."),
    255: (UNKNOWN, "Unspecified error cause reported by the network."),
    300: (MODEM_OFFLINE, "Mobile equipment failure — the modem itself reported a fault."),
    301: (MODEM_OFFLINE, "SMS service reserved/unavailable on this modem right now."),
    302: (UNKNOWN, "Operation not allowed by the modem."),
    303: (UNKNOWN, "Operation not supported by the modem."),
    304: (MESSAGE_REJECTED, "Invalid PDU-mode parameter."),
    305: (MESSAGE_REJECTED, "Invalid text-mode parameter."),
    310: (SIM_ERROR, "No SIM card detected — check that a SIM is seated in the modem."),
    311: (SIM_ERROR, "SIM requires a PIN — the SIM is PIN-locked."),
    312: (SIM_ERROR, "SIM requires a PH-SIM PIN."),
    313: (SIM_ERROR, "SIM failure — try reseating or replacing the SIM."),
    314: (SIM_ERROR, "SIM busy — try again shortly."),
    315: (SIM_ERROR, "Wrong SIM reported by the modem."),
    316: (SIM_ERROR, "SIM requires a PUK — it's been PIN-locked out."),
    317: (SIM_ERROR, "SIM requires PIN2."),
    318: (SIM_ERROR, "SIM requires PUK2."),
    320: (SIM_ERROR, "Memory failure on the SIM/modem."),
    321: (UNKNOWN, "Invalid memory index used internally."),
    322: (STORAGE_FULL, "Modem/SIM message memory is full."),
    330: (NETWORK_REJECTED, "SMS center (SMSC) address is unknown — set it explicitly if this persists."),
    331: (WEAK_OR_NO_SIGNAL, "No network service available to this modem right now."),
    332: (NETWORK_REJECTED, "Network timeout while sending."),
    340: (UNKNOWN, "No acknowledgement expected (internal protocol state)."),
    500: (WEAK_OR_NO_SIGNAL, "Unknown error (CMS 500) — in practice this is most often a weak/absent signal; check the modem's signal strength."),
    512: (WEAK_OR_NO_SIGNAL, "Manufacturer-specific error (SIM800) — usually equivalent to CMS 500 (weak/absent signal)."),
}

# +CME ERROR reuses several of the same underlying meanings (SIM state,
# equipment faults) as the +CMS 3xx block above, so we fall back to
# that table first and only special-case where CME diverges.
_CME_ERROR_EXTRA = {
    3: (UNKNOWN, "Operation not allowed by the modem."),
    4: (UNKNOWN, "Operation not supported by the modem."),
    10: (SIM_ERROR, "No SIM card detected."),
    11: (SIM_ERROR, "SIM PIN required."),
    12: (SIM_ERROR, "SIM PUK required."),
    13: (SIM_ERROR, "SIM failure."),
    14: (SIM_ERROR, "SIM busy."),
    15: (SIM_ERROR, "Wrong SIM."),
    16: (SIM_ERROR, "Incorrect password."),
    17: (SIM_ERROR, "SIM PIN2 required."),
    18: (SIM_ERROR, "SIM PUK2 required."),
    20: (MODEM_OFFLINE, "Modem memory full."),
    30: (NETWORK_REJECTED, "No network service."),
    32: (NETWORK_REJECTED, "Network not allowed — emergency calls only."),
}


def describe_cms_error(code):
    """
    code: int. Returns (category, message) — falls back to a generic
    "unknown code" message for anything not in the table (new/obscure
    carrier-specific codes) rather than raising.
    """

    entry = _CMS_ERROR_TABLE.get(code)

    if entry:
        return entry

    return (
        UNKNOWN,
        f"Modem reported CMS error {code} (not in our known-codes table — "
        "see the SIM800 AT command manual for this carrier/firmware)."
    )


def describe_cme_error(code):

    entry = _CME_ERROR_EXTRA.get(code) or _CMS_ERROR_TABLE.get(code)

    if entry:
        return entry

    return (
        UNKNOWN,
        f"Modem reported CME error {code} (not in our known-codes table)."
    )


# --- AT+CREG? registration state ---------------------------------------
#
# stat digit -> (short label, human explanation). CSQ (signal) is a raw
# RF measurement and is available independent of this — a modem can
# legitimately show real signal strength while still being "not
# registered" here, e.g. while it's mid-attach, or because of a SIM/
# account problem rather than a coverage problem.

_CREG_STATE_TABLE = {
    "0": ("NOT_SEARCHING", "Not registered, and the modem isn't currently searching for a network."),
    "1": ("REGISTERED_HOME", "Registered on the home network."),
    "2": ("SEARCHING", "Not registered yet — actively searching for a network. Often resolves within a few seconds of power-up; if it stays here, check antenna/signal."),
    "3": ("DENIED", "Registration denied by the network. This is a SIM/account problem, not a signal problem — common causes: SIM not provisioned for this modem/IMEI, barred SIM, expired SIM, or no active service on the account."),
    "4": ("UNKNOWN", "Registration status unknown (modem-reported)."),
    "5": ("REGISTERED_ROAMING", "Registered on a roaming network."),
}


def describe_registration(stat_digit):
    """
    stat_digit: the single digit captured from '+CREG: <n>,<stat>' as a
    string, or None if the CREG response couldn't be parsed at all
    (modem gave no usable reply).

    Returns (state_code, label_used_in_ui, human_message).
    """

    if stat_digit is None:
        return ("NO_RESPONSE", "No response", "Modem didn't return a usable +CREG response.")

    label, message = _CREG_STATE_TABLE.get(
        stat_digit,
        ("UNKNOWN", f"Unrecognized registration status ({stat_digit}).")
    )

    return (label, label.replace("_", " ").title(), message)


# --- Turning a raw failure string (as stored in SmsLog.error_message /
#     Sim800Service failure entries) into (category, human message) ----

_CMS_RE = re.compile(r"\+CMS ERROR:\s*(\d+)")
_CME_RE = re.compile(r"\+CME ERROR:\s*(\d+)")


def classify_failure(raw_text):
    """
    Best-effort classification of whatever text we already collected
    for a failed send — a +CMS/+CME ERROR line, one of our own internal
    messages ("modem not registered...", "TIMEOUT..."), or something
    else entirely. Never raises; unrecognized text just comes back as
    UNKNOWN with the original text preserved so nothing is ever hidden
    from the log, only augmented.
    """

    if not raw_text:
        return (UNKNOWN, "No response recorded.")

    cms_match = _CMS_RE.search(raw_text)

    if cms_match:
        return describe_cms_error(int(cms_match.group(1)))

    cme_match = _CME_RE.search(raw_text)

    if cme_match:
        return describe_cme_error(int(cme_match.group(1)))

    lowered = raw_text.lower()

    if "not registered" in lowered:
        return (
            MODEM_OFFLINE,
            "Modem was not registered to the network at send time. " + raw_text
        )

    if "already in progress on another modem" in lowered:
        return (
            RECIPIENT_BUSY,
            "Another modem was already sending to this recipient and this "
            "attempt timed out waiting its turn."
        )

    if "no responsive sms modem found" in lowered or "no serial ports detected" in lowered:
        return (
            MODEM_OFFLINE,
            "No configured modem responded at all — check that the modems "
            "are powered, plugged in, and not in use by another program."
        )

    if lowered.startswith("timeout") or " timeout " in f" {lowered} " or lowered.endswith("timeout"):
        return (TIMEOUT, raw_text)

    return (UNKNOWN, raw_text)
