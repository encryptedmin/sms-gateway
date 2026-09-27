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
from contacts.views import visible_contact_groups_for_user
from contacts.views import visible_contacts_for_user

from core.phone import normalize_phone_number

from users.permissions import IsAdminRole
from users.permissions import IsSubscriber
from users.permissions import CanSendSms
from users.permissions import IsSuperAdmin

from .models import ApiKey
from .models import SmsLog
from .models import Subscription
from .models import SmsRetryPolicy
from .models import ModemStatus

from .serializers import ApiKeySerializer
from .serializers import SmsLogSerializer
from .serializers import SubscriptionSerializer
from .serializers import SmsRetryPolicySerializer

from .services import Sim800Service
from .tasks import process_sms
from .tasks import _redis_client


def _extract_api_key(request):
    """
    API key must be supplied as: Authorization: Bearer <key>
    This is the only supported convention. (Previously also accepted a
    raw `api_key` field in the POST body — dropped since no external
    integration exists yet and the JWT flow already uses the same
    Bearer header convention, keeping auth handling consistent
    across both auth paths.)
    """

    auth_header = request.headers.get(
        "Authorization",
        ""
    )

    if auth_header.lower().startswith("bearer "):
        return auth_header.split(
            " ",
            1
        )[1].strip()

    return None


def _queue_sms(
    subscriber,
    recipient,
    message,
    sent_by=None
):

    log = SmsLog.objects.create(
        subscriber=subscriber,
        recipient=recipient,
        message=message,
        status="PENDING",
        sent_by=sent_by
    )

    try:

        process_sms.delay(
            log.id
        )

    except Exception as ex:

        # If Celery/Redis can't even accept the task (broker briefly
        # unreachable, etc), the row above would otherwise sit at
        # PENDING forever with no task ever having been created to
        # retry it — nothing would ever touch it again. Mark it FAILED
        # immediately instead, with a reason, so it shows up for a
        # manual resend rather than silently vanishing into a
        # never-processed PENDING row.

        log.status = "FAILED"
        log.error_message = f"Could not queue for sending: {ex}"
        log.response_message = log.error_message
        log.failure_category = "UNKNOWN"
        log.save()

    return log


def _active_contacts_queryset(request_user=None):

    queryset = Contact.objects.all()

    if request_user:
        queryset = visible_contacts_for_user(request_user)

    return queryset.filter(
        active=True
    ).order_by(
        "first_name",
        "last_name",
    )


def _resolve_group_for_sending(group_id, request_user):

    try:
        group = visible_contact_groups_for_user(request_user).get(id=group_id)
    except ContactGroup.DoesNotExist:
        return None, Response(
            {"error": "group not found"},
            status=404
        )

    return group, None


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

    try:
        recipient = normalize_phone_number(recipient)
    except ValueError as ex:

        # This is a hard requirement, not just cosmetic validation:
        # Sim800Service.send_sms interpolates `recipient` directly into
        # an AT+CMGS="<recipient>" modem command with no escaping, so an
        # unvalidated value here could inject arbitrary AT commands into
        # the modem session. Reject before it ever reaches a queued
        # SmsLog / Sim800Service.

        return Response(
            {
                "error": str(ex)
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

    subscriber = key.subscriber

    if not subscriber.active:

        return Response(
            {
                "error": "subscriber account is inactive"
            },
            status=403
        )

    subscription = Subscription.objects.select_related(
        "plan"
    ).filter(
        subscriber=subscriber,
        status="ACTIVE"
    ).first()

    if not subscription:

        return Response(
            {
                "error": "no active subscription for this account"
            },
            status=403
        )

    if not subscription.has_quota_remaining():

        return Response(
            {
                "error": (
                    "Monthly message limit reached for this plan. "
                    "It resets automatically at the start of the next period."
                )
            },
            status=429
        )

    log = _queue_sms(
        subscriber=subscriber,
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

    contacts = _active_contacts_queryset(request.user)
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
            group, error_response = _resolve_group_for_sending(
                group_id,
                request.user
            )

            if error_response:
                return error_response

            contacts = group.get_all_contacts().filter(
                active=True
            )
            target_label = group.name

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

        group, error_response = _resolve_group_for_sending(
            group_id,
            request.user
        )

        if error_response:
            return error_response

        contacts = group.get_all_contacts().filter(
            active=True
        )
        target_label = group.name

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
            message=message,
            sent_by=request.user
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
        "post",
    ]

    def get_queryset(self):

        queryset = SmsLog.objects.select_related(
            "subscriber",
            "subscriber__user",
            "sent_by",
        ).all().order_by("-created_at")

        if self.request.user.role == "INSTRUCTOR":
            queryset = queryset.filter(
                sent_by=self.request.user
            )

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

    def get_serializer_context(self):

        context = super().get_serializer_context()

        # Fetched once per request/response rather than once per row —
        # SmsRetryPolicy is a singleton table, so this avoids an N+1
        # query when the serializer computes can_retry for a whole page
        # of logs.
        context["retry_policy"] = SmsRetryPolicy.current()

        return context

    @action(
        detail=True,
        methods=["post"]
    )
    def retry(self, request, pk=None):
        """
        Manually re-queues a single FAILED send. There's no automatic
        retry anymore (see gateway/tasks.py) — a failed message stays
        FAILED, with its reason, until this endpoint is called, which
        is exactly what the Retry button in the SMS Logs UI does.

        get_object() below reuses get_queryset()'s scoping, so this
        naturally enforces the same permissions as the list view (an
        INSTRUCTOR can't retry someone else's send — it 404s, same as
        trying to view it would).
        """

        log = self.get_object()

        if log.status != "FAILED":

            return Response(
                {"detail": "Only failed messages can be retried."},
                status=status.HTTP_400_BAD_REQUEST
            )

        policy = SmsRetryPolicy.current()

        if log.attempts > policy.max_retries:

            return Response(
                {
                    "detail": (
                        "This message has already used its "
                        f"{policy.max_retries} allowed retry attempt(s)."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        log.status = "PENDING"
        log.error_message = ""
        log.failure_category = ""
        log.save(
            update_fields=[
                "status",
                "error_message",
                "failure_category",
            ]
        )

        try:

            process_sms.delay(
                log.id
            )

        except Exception as ex:

            # Same reasoning as _queue_sms in send_sms/department_send_sms
            # below: if Celery/Redis can't even accept the task, don't
            # leave this row sitting at PENDING with no task ever
            # created to act on it — go straight back to FAILED with a
            # reason so the Retry button is available again.

            log.status = "FAILED"
            log.error_message = f"Could not queue retry: {ex}"
            log.response_message = log.error_message
            log.failure_category = "UNKNOWN"
            log.save()

            return Response(
                {"detail": log.error_message},
                status=status.HTTP_502_BAD_GATEWAY
            )

        return Response(
            self.get_serializer(log).data,
            status=status.HTTP_202_ACCEPTED
        )


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


@api_view(["GET", "PATCH"])
@permission_classes([IsSuperAdmin])
def retry_policy(request):
    """
    Lets the super admin view and tune how gateway.tasks.process_sms
    retries a failed send (attempt count + backoff), without touching
    code or redeploying.
    """

    policy = SmsRetryPolicy.current()

    if request.method == "PATCH":

        serializer = SmsRetryPolicySerializer(
            policy,
            data=request.data,
            partial=True
        )

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save(
            updated_by=request.user
        )

        return Response(
            serializer.data
        )

    return Response(
        SmsRetryPolicySerializer(policy).data
    )


MODEM_STATUS_COOLDOWN_SECONDS = 30
MODEM_STATUS_COOLDOWN_KEY = "modem_status:cooldown"


def _serialize_modem_statuses():

    rows = ModemStatus.objects.all().order_by("port")

    return [
        {
            "port": row.port,
            "online": row.is_online,
            "signal_bucket": row.signal_bucket,
            "signal_csq": row.signal_csq,
            "registration_state": row.registration_state,
            "registration_detail": row.registration_detail,
            "last_checked": row.last_checked,
            "last_checked_by": (
                row.last_checked_by.username
                if row.last_checked_by_id else None
            ),
        }
        for row in rows
    ]


@api_view(["GET"])
@permission_classes([IsAdminRole])
def modem_status(request):
    """
    Read-only — returns whatever was last recorded, never touches the
    hardware. Safe to call on every page load/refresh.
    """

    return Response(
        {
            "cooldown_seconds": MODEM_STATUS_COOLDOWN_SECONDS,
            "modems": _serialize_modem_statuses(),
        }
    )


@api_view(["POST"])
@permission_classes([IsAdminRole])
def modem_status_check(request):
    """
    The deliberate "check now" action — scans every serial port on the
    machine, confirms which ones are actually a SIM800 modem (not just
    "some serial device exists here"), and records online/offline +
    signal for each. Works regardless of which USB port or COM number
    a modem enumerates as. Global cooldown (not per-user): the SIM
    doesn't care which admin is asking, so one admin checking shouldn't
    let another immediately check again and double up on hardware
    traffic.
    """

    client = _redis_client()

    ttl = client.ttl(MODEM_STATUS_COOLDOWN_KEY)

    if ttl and ttl > 0:

        return Response(
            {
                "error": "Status check is on cooldown.",
                "retry_after_seconds": ttl,
                "cooldown_seconds": MODEM_STATUS_COOLDOWN_SECONDS,
                "modems": _serialize_modem_statuses(),
            },
            status=429
        )

    acquired = client.set(
        MODEM_STATUS_COOLDOWN_KEY,
        "1",
        nx=True,
        ex=MODEM_STATUS_COOLDOWN_SECONDS
    )

    if not acquired:

        # Lost a race with another admin's simultaneous click — treat
        # it the same as an active cooldown rather than double-checking.

        ttl = client.ttl(MODEM_STATUS_COOLDOWN_KEY) or MODEM_STATUS_COOLDOWN_SECONDS

        return Response(
            {
                "error": "Status check is on cooldown.",
                "retry_after_seconds": ttl,
                "cooldown_seconds": MODEM_STATUS_COOLDOWN_SECONDS,
                "modems": _serialize_modem_statuses(),
            },
            status=429
        )

    probe = Sim800Service()
    discovered_ports = probe.discover_all_modem_ports()

    # Drop stale rows for ports that no longer have a SIM800 on them —
    # e.g. a modem that was moved to a different USB port since the
    # last check. Without this, an old port would keep showing up
    # (and keep getting round-robin'd to) even though nothing's there
    # anymore.
    ModemStatus.objects.exclude(
        port__in=discovered_ports
    ).delete()

    for port in discovered_ports:

        result = probe.check_status(port)
        signal_csq = result["signal_csq"]

        ModemStatus.objects.update_or_create(
            port=port,
            defaults={
                "is_online": result["online"],
                "signal_csq": signal_csq,
                "signal_bucket": ModemStatus.bucket_for_csq(signal_csq),
                "registration_state": result["registration_state"],
                "registration_detail": result["registration_detail"],
                "last_checked_by": request.user,
            }
        )

    return Response(
        {
            "cooldown_seconds": MODEM_STATUS_COOLDOWN_SECONDS,
            "modems": _serialize_modem_statuses(),
        }
    )
