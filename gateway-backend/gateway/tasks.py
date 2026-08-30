import time

import redis
from celery import shared_task
from celery.utils.log import get_task_logger
from django.conf import settings
from django.utils import timezone

from .models import SmsLog
from .models import SmsRetryPolicy
from .models import Subscription
from .services import Sim800Service

logger = get_task_logger(__name__)

# Safety-net TTL on the per-recipient lock in case a worker dies mid-send
# and never releases it (crash, power loss on the Windows box, etc).
RECIPIENT_LOCK_TTL_SECONDS = 90

RECIPIENT_LOCK_POLL_INTERVAL_SECONDS = 0.5

# How long a task will wait for another modem to finish texting the same
# recipient before giving up and treating this attempt as failed. Comfortably
# above the modem's own worst-case send time (RESPONSE_TIMEOUT + settle).
RECIPIENT_LOCK_WAIT_TIMEOUT_SECONDS = 40


def _redis_client():

    return redis.Redis.from_url(
        settings.CELERY_BROKER_URL
    )


def _recipient_lock_key(recipient):

    return f"sms:sending:{recipient}"


def _acquire_recipient_lock(client, recipient):
    """
    Prevents two modems from ever transmitting to the exact same
    recipient at the exact same time (e.g. a duplicate contact row, or
    a broadcast that resolves to the same number twice). Polls briefly
    rather than failing immediately, since the other send is usually
    only a few seconds from finishing.

    Returns True if the lock was acquired.
    """

    key = _recipient_lock_key(recipient)
    deadline = time.monotonic() + RECIPIENT_LOCK_WAIT_TIMEOUT_SECONDS

    while time.monotonic() < deadline:

        acquired = client.set(
            key,
            "1",
            nx=True,
            ex=RECIPIENT_LOCK_TTL_SECONDS
        )

        if acquired:
            return True

        time.sleep(
            RECIPIENT_LOCK_POLL_INTERVAL_SECONDS
        )

    return False


def _release_recipient_lock(client, recipient):

    client.delete(
        _recipient_lock_key(recipient)
    )


def _pick_modem_port(log_id):
    """
    Round robin across whichever configured modems are physically
    detected right now. Deterministic on log_id so a message rotates
    predictably across modems even across retries. Returns None if no
    configured port is currently detected — Sim800Service then falls
    back to its own candidate search (dev machines, SMS_DEV_MODE, etc).
    """

    probe = Sim800Service()
    detected = probe.detected_ports()

    if not detected:
        return None

    return detected[log_id % len(detected)]


@shared_task(bind=True)
def process_sms(self, log_id):

    try:

        log = SmsLog.objects.get(
            id=log_id
        )

    except SmsLog.DoesNotExist:

        logger.error(
            "SmsLog %s no longer exists, dropping task",
            log_id
        )

        return False

    policy = SmsRetryPolicy.current()
    port = _pick_modem_port(log_id)

    log.attempts += 1
    log.modem_port = port or ""
    log.status = "RETRYING" if self.request.retries else "PENDING"
    log.save(
        update_fields=[
            "attempts",
            "modem_port",
            "status",
        ]
    )

    success = False
    response = ""
    client = None
    got_lock = False

    try:

        client = _redis_client()
        got_lock = _acquire_recipient_lock(
            client,
            log.recipient
        )

        if not got_lock:

            response = (
                f"Timed out waiting to send to {log.recipient} "
                "(already in progress on another modem)"
            )

        else:

            modem = Sim800Service(
                port=port
            )

            success, response, used_port = modem.send_sms(
                log.recipient,
                log.message
            )

            if used_port:
                log.modem_port = used_port

    except Exception as ex:

        # Unexpected infra error (Redis unreachable, an exception
        # Sim800Service didn't already normalize, etc) — treat it as a
        # failed attempt instead of crashing the worker.

        success = False
        response = str(ex) or ex.__class__.__name__

    finally:

        if got_lock and client is not None:
            _release_recipient_lock(client, log.recipient)

    if not response:
        response = "No modem response returned"

    log.response_message = response

    if success:

        log.status = "SENT"
        log.sent_at = timezone.now()
        log.error_message = ""
        log.save()

        if log.subscriber_id:

            # ITE-originated sends (department_send_sms) have no
            # subscriber and aren't metered — only API-key sends
            # against a subscriber's plan count toward a quota.

            subscription = Subscription.objects.filter(
                subscriber_id=log.subscriber_id,
                status="ACTIVE"
            ).select_related("plan").first()

            if subscription:
                subscription.record_successful_send()

        return True

    log.error_message = response

    if self.request.retries < policy.max_retries:

        log.status = "RETRYING"
        log.save()

        countdown = policy.backoff_seconds(
            self.request.retries + 1
        )

        raise self.retry(
            countdown=countdown,
            max_retries=policy.max_retries
        )

    log.status = "FAILED"
    log.save()

    return False
