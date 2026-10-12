import time

import redis
from celery import shared_task
from celery.utils.log import get_task_logger
from django.conf import settings
from django.utils import timezone

from .models import SmsLog
from .models import Subscription
from .modem_subprocess import send_sms_with_hard_timeout
from .services import Sim800Service
from .sms_errors import ACCOUNT_BLOCKED
from .sms_errors import RECIPIENT_BUSY
from .sms_errors import UNKNOWN
from .sms_errors import classify_failure

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
        settings.REDIS_URL
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


def _mark_failed(
    log,
    response,
    category
):
    """
    Writes a terminal FAILED status with the reason attached. There is
    no automatic retry anymore — see SmsLogViewSet.retry() in views.py
    for the manual flow this feeds: a FAILED row with error_message/
    failure_category populated is exactly what the frontend's Retry
    button reads and acts on. This is the one place that writes FAILED,
    so every failure path (a clean send failure, a recipient-lock
    timeout, or the catch-all safety net below) ends up in the same
    guaranteed-to-be-saved final state — a message can never be left
    sitting at PENDING forever with no failure ever recorded.
    """

    log.response_message = response
    log.error_message = response
    log.failure_category = category
    log.attempts = max(log.attempts, 1)
    log.status = "FAILED"
    log.save()

    return False


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

    # Everything below is wrapped so that NO exception — a DB hiccup, a
    # bug we didn't anticipate — can leave `log` sitting at PENDING
    # forever with no attempt recorded. A single call to this task is
    # always exactly one send attempt, ending in either SENT or FAILED;
    # nothing in between, and nothing silent. Retrying a FAILED message
    # is now a deliberate action (SmsLogViewSet.retry() re-queues this
    # same task), not something that happens on its own in the
    # background — which is also why there's no more RETRYING status
    # or backoff scheduling to reason about here.
    if log.status in ("SCHEDULED", "CANCELLED"):

        # Never send a message that is still waiting for its time or was
        # cancelled, even if a stray task for it shows up. Scheduled rows
        # reach this task only via release_scheduled_log(), which first
        # moves them to PENDING.
        logger.warning(
            "SmsLog %s is %s, not sending",
            log_id,
            log.status
        )

        return False

    try:

        port = _pick_modem_port(log_id)

        log.attempts += 1
        log.modem_port = port or ""
        log.status = "PENDING"
        log.save(
            update_fields=[
                "attempts",
                "modem_port",
                "status",
            ]
        )

        success = False
        response = ""
        category = ""
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
                category = RECIPIENT_BUSY

            else:

                # Runs in a killable child process rather than calling
                # Sim800Service.send_sms() directly in this thread — see
                # modem_subprocess.py for why: this worker runs
                # --pool=threads (Windows has no os.fork() for prefork),
                # and celery's thread pool enforces no time limit at
                # all, on any OS, so a wedged pyserial call would
                # otherwise occupy this thread's single prefetch slot
                # forever with nothing to stop it.
                success, response, used_port = send_sms_with_hard_timeout(
                    port,
                    log.recipient,
                    log.message,
                    settings.SMS_SEND_HARD_TIMEOUT_SECONDS
                )

                if used_port:
                    log.modem_port = used_port

        except Exception as ex:

            # Unexpected infra error (Redis unreachable, an exception
            # send_sms_with_hard_timeout didn't already normalize, etc)
            # — treat it as a failed attempt instead of crashing the
            # worker.

            success = False
            response = str(ex) or ex.__class__.__name__

        finally:

            if got_lock and client is not None:
                _release_recipient_lock(client, log.recipient)

        if not response:
            response = "No modem response returned"

        if success:

            log.response_message = response
            log.status = "SENT"
            log.sent_at = timezone.now()
            log.error_message = ""
            log.failure_category = ""
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

        if not category:
            category, _ = classify_failure(response)

        return _mark_failed(
            log,
            response,
            category
        )

    except Exception as ex:

        # Absolute last resort: something outside every guard above
        # (e.g. a database error saving `log` itself) blew up. Still
        # record a real FAILED status rather than silently dropping the
        # task, and log loudly so it's visible in worker logs instead
        # of just vanishing.

        logger.exception(
            "process_sms(%s) hit an unhandled error outside the normal "
            "failure path",
            log_id
        )

        return _mark_failed(
            log,
            f"Unexpected error: {ex}",
            UNKNOWN
        )



def _account_block_reason(subscriber):
    """
    Why a subscriber's scheduled message can no longer be sent, or None.
    The same rules send_sms applies to an immediate API-key send, checked
    again at release time because days can pass between scheduling and
    sending (account disabled, plan changed, quota used up).
    """

    if not subscriber.active:
        return "Subscriber account is inactive."

    subscription = Subscription.objects.select_related(
        "plan"
    ).filter(
        subscriber=subscriber,
        status="ACTIVE"
    ).first()

    if not subscription:
        return "No active subscription for this account."

    if not subscription.has_quota_remaining():
        return (
            "Monthly message limit reached for this plan. Retry after "
            "the period resets."
        )

    return None


def release_scheduled_log(log_id):
    """
    Hands one due SCHEDULED message to the normal send pipeline.

    The SCHEDULED -> PENDING flip is a single conditional UPDATE, so if a
    cancel, a reschedule, "send now" and the dispatcher race, exactly one
    of them wins; the others see zero rows changed and do nothing. That
    also makes releasing idempotent: a message can never be queued twice.

    Returns True if the message was queued for sending.
    """

    claimed = SmsLog.objects.filter(
        id=log_id,
        status="SCHEDULED"
    ).update(
        status="PENDING"
    )

    if not claimed:
        return False

    log = SmsLog.objects.select_related(
        "subscriber"
    ).get(
        id=log_id
    )

    if log.subscriber_id:

        reason = _account_block_reason(
            log.subscriber
        )

        if reason:

            _mark_failed(
                log,
                reason,
                ACCOUNT_BLOCKED
            )

            return False

    try:

        process_sms.delay(
            log.id
        )

    except Exception as ex:

        _mark_failed(
            log,
            f"Could not queue for sending: {ex}",
            UNKNOWN
        )

        return False

    return True


@shared_task
def dispatch_due_scheduled_sms(batch_size=200):
    """
    Run every few seconds by Celery beat (CELERY_BEAT_SCHEDULE). Releases
    messages whose scheduled_for has arrived, oldest first. batch_size
    bounds one tick's work; anything left over is picked up by the next.
    """

    due_ids = list(
        SmsLog.objects.filter(
            status="SCHEDULED",
            scheduled_for__lte=timezone.now()
        ).order_by(
            "scheduled_for",
            "id"
        ).values_list(
            "id",
            flat=True
        )[:batch_size]
    )

    released = 0

    for log_id in due_ids:

        if release_scheduled_log(log_id):
            released += 1

    if due_ids:

        logger.info(
            "Scheduled SMS: %s due, %s released",
            len(due_ids),
            released
        )

    return released
