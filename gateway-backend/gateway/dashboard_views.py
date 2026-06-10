from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes
from rest_framework.response import Response

from users.permissions import CanSendSms

from .models import SmsLog


@api_view(["GET"])
@permission_classes([CanSendSms])
def dashboard_stats(request):

    total_messages = SmsLog.objects.count()

    sent_messages = SmsLog.objects.filter(
        status="SENT"
    ).count()

    failed_messages = SmsLog.objects.filter(
        status="FAILED"
    ).count()

    pending_messages = SmsLog.objects.filter(
        status="PENDING"
    ).count()

    return Response(
        {
            "total_messages": total_messages,
            "sent_messages": sent_messages,
            "failed_messages": failed_messages,
            "pending_messages": pending_messages,
        }
    )