from rest_framework.decorators import api_view
from rest_framework.decorators import authentication_classes
from rest_framework.decorators import permission_classes
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from contacts.models import Contact
from contacts.models import ContactGroup

from subscribers.models import Subscriber

from users.permissions import IsAdminRole
from users.permissions import IsSubscriber
from users.permissions import CanSendSms

from .models import ApiKey
from .models import SmsLog
from .models import Subscription

from .serializers import ApiKeySerializer
from .serializers import SmsLogSerializer
from .serializers import SubscriptionSerializer

from .tasks import process_sms


def _extract_api_key(request):

    auth_header = request.headers.get(
        "Authorization",
        ""
    )

    if auth_header.lower().startswith("bearer "):
        return auth_header.split(
            " ",
            1
        )[1].strip()

    return request.data.get("api_key")


def _queue_sms(
    subscriber,
    recipient,
    message
):

    log = SmsLog.objects.create(
        subscriber=subscriber,
        recipient=recipient,
        message=message,
        status="PENDING"
    )

    process_sms.delay(
        log.id
    )

    return log


def _active_contacts_queryset():

    return Contact.objects.filter(
        active=True
    ).order_by(
        "first_name",
        "last_name",
    )


@api_view(["POST"])
@authentication_classes([])
def send_sms(request):

    api_key = _extract_api_key(
        request
    )

    recipient = request.data.get("recipient")

    message = request.data.get("message")

    if not api_key:

        return Response(
            {
                "error": "api_key required"
            },
            status=400
        )

    if not recipient:

        return Response(
            {
                "error": "recipient required"
            },
            status=400
        )

    if not message:

        return Response(
            {
                "error": "message required"
            },
            status=400
        )

    try:

        key = ApiKey.objects.get(
            api_key=api_key,
            enabled=True
        )

    except ApiKey.DoesNotExist:

        return Response(
            {
                "error": "invalid api key"
            },
            status=403
        )

    log = _queue_sms(
        subscriber=key.subscriber,
        recipient=recipient,
        message=message
    )

    return Response(
        {
            "status": "queued",
            "log_id": log.id
        }
    )


@api_view(["POST"])
@permission_classes([CanSendSms])
def broadcast_sms(request):

    group_id = request.data.get(
        "group_id"
    )

    message = request.data.get(
        "message"
    )

    subscriber_id = request.data.get("subscriber_id")

    if not group_id:

        return Response(
            {
                "error": "group_id required"
            },
            status=400
        )

    if not message:

        return Response(
            {
                "error": "message required"
            },
            status=400
        )

    try:

        group = ContactGroup.objects.get(
            id=group_id
        )

    except ContactGroup.DoesNotExist:

        return Response(
            {
                "error": "group not found"
            },
            status=404
        )

    subscriber = None

    if subscriber_id:

        try:
            subscriber = Subscriber.objects.get(
                id=subscriber_id
            )

        except Subscriber.DoesNotExist:
            return Response(
                {
                    "error": "subscriber not found"
                },
                status=404
            )

    else:

        subscriber = getattr(
            request.user,
            "subscriber",
            None
        )

    if not subscriber:
        return Response(
            {
                "error": "subscriber_id required for this user"
            },
            status=400
        )

    contacts = group.contact_set.filter(
        active=True
    )

    queued = 0

    for contact in contacts:

        _queue_sms(
            subscriber=subscriber,
            recipient=contact.mobile_number,
            message=message
        )

        queued += 1

    return Response(
        {
            "status": "queued",
            "group": group.name,
            "contacts": queued
        }
    )


@api_view(["POST"])
@permission_classes([CanSendSms])
def department_send_sms(request):

    target_type = request.data.get(
        "target_type",
        "contact"
    )
    message = request.data.get("message")

    if not message:
        return Response(
            {
                "error": "message required"
            },
            status=400
        )

    contacts = _active_contacts_queryset()
    target_label = "contacts"

    if target_type == "contact":
        contact_id = request.data.get("contact_id")

        if not contact_id:
            return Response(
                {
                    "error": "contact_id required"
                },
                status=400
            )

        contacts = contacts.filter(
            id=contact_id
        )
        target_label = "contact"

    elif target_type == "year":
        year_level = request.data.get("year_level")

        if not year_level:
            return Response(
                {
                    "error": "year_level required"
                },
                status=400
            )

        contacts = contacts.filter(
            year_level__iexact=year_level
        )
        target_label = f"year level {year_level}"

    elif target_type == "class":
        group_id = request.data.get("group_id")
        year_level = request.data.get("year_level")
        section = request.data.get("section")

        if group_id:
            contacts = contacts.filter(
                groups__id=group_id
            )
            target_label = "group"

        else:
            if not year_level or not section:
                return Response(
                    {
                        "error": "year_level and section required"
                    },
                    status=400
                )

            contacts = contacts.filter(
                year_level__iexact=year_level,
                section__iexact=section
            )
            target_label = f"{year_level} {section}"

    elif target_type == "group":
        group_id = request.data.get("group_id")

        if not group_id:
            return Response(
                {
                    "error": "group_id required"
                },
                status=400
            )

        contacts = contacts.filter(
            groups__id=group_id
        )
        target_label = "group"

    elif target_type == "all":
        target_label = "all contacts"

    else:
        return Response(
            {
                "error": "invalid target_type"
            },
            status=400
        )

    contacts = contacts.distinct()

    queued = 0

    for contact in contacts:
        _queue_sms(
            subscriber=None,
            recipient=contact.mobile_number,
            message=message
        )
        queued += 1

    return Response(
        {
            "status": "queued",
            "target": target_label,
            "contacts": queued
        }
    )


class SmsLogViewSet(ModelViewSet):

    serializer_class = SmsLogSerializer
    permission_classes = [
        CanSendSms
    ]
    http_method_names = [
        "get",
        "head",
        "options",
    ]

    def get_queryset(self):

        queryset = SmsLog.objects.select_related(
            "subscriber",
            "subscriber__user",
        ).all().order_by("-created_at")

        status_filter = self.request.query_params.get("status")
        subscriber_id = self.request.query_params.get("subscriber_id")

        if status_filter:
            queryset = queryset.filter(
                status=status_filter.upper()
            )

        if subscriber_id:
            queryset = queryset.filter(
                subscriber_id=subscriber_id
            )

        return queryset


class SubscriptionViewSet(ModelViewSet):

    serializer_class = SubscriptionSerializer
    permission_classes = [
        IsAuthenticated
    ]

    def get_queryset(self):

        queryset = Subscription.objects.select_related(
            "subscriber",
            "subscriber__user",
            "plan",
        ).all().order_by("-id")

        if self.request.user.role == "SUBSCRIBER":
            return queryset.filter(
                subscriber__user=self.request.user
            )

        return queryset

    def get_permissions(self):

        if self.action in [
            "create",
            "update",
            "partial_update",
            "destroy",
        ]:
            return [
                IsAdminRole()
            ]

        return [
            IsAuthenticated()
        ]

    @action(
        detail=True,
        methods=[
            "post",
        ]
    )
    def unsubscribe(self, request, pk=None):

        subscription = self.get_object()
        subscription.status = "INACTIVE"
        subscription.save(
            update_fields=[
                "status",
            ]
        )

        return Response(
            self.get_serializer(subscription).data
        )


class ApiKeyViewSet(ModelViewSet):

    serializer_class = ApiKeySerializer
    permission_classes = [
        IsAuthenticated
    ]
    http_method_names = [
        "get",
        "post",
        "patch",
        "head",
        "options",
    ]

    def get_queryset(self):

        queryset = ApiKey.objects.select_related(
            "subscriber",
            "subscriber__user",
        ).all().order_by("-created_at")

        if self.request.user.role == "SUBSCRIBER":
            return queryset.filter(
                subscriber__user=self.request.user
            )

        return queryset

    def get_permissions(self):

        if self.action in [
            "create",
            "partial_update",
            "update",
        ]:
            return [
                IsAdminRole()
            ]

        return [
            IsAuthenticated()
        ]

    @action(
        detail=False,
        methods=[
            "get",
        ],
        permission_classes=[
            IsSubscriber
        ]
    )
    def mine(self, request):

        subscriber = getattr(
            request.user,
            "subscriber",
            None
        )

        if not subscriber:
            return Response(
                {
                    "error": "subscriber profile not found"
                },
                status=status.HTTP_404_NOT_FOUND
            )

        key, _ = ApiKey.objects.get_or_create(
            subscriber=subscriber
        )

        return Response(
            self.get_serializer(key).data
        )
