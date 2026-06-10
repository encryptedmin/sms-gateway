from celery import shared_task
from django.utils import timezone

from .models import SmsLog
from .services import Sim800Service


@shared_task
def process_sms(log_id):

    log = None

    try:

        log = SmsLog.objects.get(
            id=log_id
        )

        modem = Sim800Service()

        success, response = modem.send_sms(
            log.recipient,
            log.message
        )

        if not response:

            response = "No modem response returned"

        log.response_message = response

        if success:

            log.status = "SENT"
            log.sent_at = timezone.now()

        else:

            log.status = "FAILED"

            log.error_message = response

        log.save()

        return True

    except Exception as ex:

        try:

            if log is None:

                log = SmsLog.objects.get(
                    id=log_id
                )

            response = str(ex) or ex.__class__.__name__

            log.status = "FAILED"

            log.error_message = response

            log.response_message = response

            log.save()

        except Exception:
            pass

        return False
