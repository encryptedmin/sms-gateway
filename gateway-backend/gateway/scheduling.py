"""
Validation for scheduled sends.

A scheduled message is an ordinary SmsLog row with status SCHEDULED and a
scheduled_for time. It is *not* queued in Celery with an ``eta``: this
project's Redis broker redelivers unacknowledged tasks after
CELERY_BROKER_TRANSPORT_OPTIONS["visibility_timeout"] (10 minutes), so a
task parked for hours would be delivered over and over. Instead the row waits
in the database and gateway.tasks.dispatch_due_scheduled_sms (run every few
seconds by Celery beat) hands it to the normal process_sms task once due.
"""

from datetime import datetime
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime


class ScheduleError(ValueError):
    """scheduled_for was present but not usable. str() is user-facing."""


def parse_scheduled_for(value):
    """
    Returns an aware datetime, or None when no schedule was requested
    (missing / null / empty string, meaning "send now").

    Clients should send ISO 8601 with a UTC offset, e.g.
    ``2026-10-20T15:30:00+08:00`` or ``2026-10-20T07:30:00Z``. A value
    with no offset is read as the server's TIME_ZONE (UTC).

    A time up to SMS_SCHEDULE_PAST_TOLERANCE_SECONDS in the past is
    accepted and simply goes out on the next dispatcher tick, so a
    minute-resolution picker set to "now" is not rejected.
    """

    if value is None or value == "":
        return None

    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = parse_datetime(str(value).strip())
        except ValueError:
            parsed = None

    if parsed is None:
        raise ScheduleError(
            "scheduled_for must be an ISO 8601 date and time, for example "
            "2026-10-20T15:30:00+08:00."
        )

    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)

    now = timezone.now()

    tolerance = timedelta(
        seconds=settings.SMS_SCHEDULE_PAST_TOLERANCE_SECONDS
    )

    if parsed < now - tolerance:
        raise ScheduleError("scheduled_for must be in the future.")

    max_days = settings.SMS_SCHEDULE_MAX_DAYS

    if parsed > now + timedelta(days=max_days):
        raise ScheduleError(
            f"scheduled_for can be at most {max_days} days ahead."
        )

    return parsed
