import uuid

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

from .scheduling import ScheduleError
from .scheduling import parse_scheduled_for
from .services import Sim800Service
from .tasks import process_sms
from .tasks import release_scheduled_log
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
    sent_by=None,
    recipient_name="",
    scheduled_for=None,
    batch_id=None
):

    if scheduled_for is not None:

        # Waits in the database; gateway.tasks.dispatch_due_scheduled_sms
        # (Celery beat) releases it at scheduled_for. See scheduling.py.
        return SmsLog.objects.create(
            subscriber=subscriber,
            recipient=recipient,
            recipient_name=recipient_name,
            message=message,
            status="SCHEDULED",
            sent_by=sent_by,
            scheduled_for=scheduled_for,
            batch_id=batch_id
        )

    log = SmsLog.objects.create(
        subscriber=subscriber,
        recipient=recipient,
        recipient_name=recipient_name,
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

        scheduled_for = parse_scheduled_for(
            request.data.get("scheduled_for")
        )

    except ScheduleError as ex:

        return Response(
            {
                "error": str(ex)
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
        message=message,
        scheduled_for=scheduled_for
    )

    if scheduled_for is not None:

        return Response(
            {
                "status": "scheduled",
                "log_id": log.id,
                "scheduled_for": scheduled_for
            }
        )

    return Response(
        {
            "status": "queued",
            "log_id": log.id
        }
    )


@api_view(["GET"])
@authentication_classes([])
def api_messages(request):
    """
    Read-only companion to send_sms for API-key clients: the account's own
    recent messages (with delivery status) and its plan usage, so an
    external messaging app can show history without a staff login.
    """

    api_key = _extract_api_key(
        request
    )

    if not api_key:

        return Response(
            {
                "error": "api_key required"
            },
            status=400
        )

    key = ApiKey.objects.select_related(
        "subscriber__user"
    ).filter(
        api_key=api_key,
        enabled=True
    ).first()

    if key is None or not key.subscriber.active:

        return Response(
            {
                "error": "invalid api key"
            },
            status=403
        )

    subscriber = key.subscriber
    user = subscriber.user

    subscription = Subscription.objects.select_related(
        "plan"
    ).filter(
        subscriber=subscriber,
        status="ACTIVE"
    ).first()

    account = {
        "name": f"{user.first_name} {user.last_name}".strip() or user.username,
        "plan": None,
    }

    if subscription:

        plan = subscription.plan

        account["plan"] = {
            "name": plan.plan_name,
            "type": plan.plan_type,
            "limit": plan.message_limit if plan.plan_type == "LIMITED" else None,
            "used": (
                subscription.current_usage()
                if plan.plan_type == "LIMITED" else None
            ),
        }

    logs = SmsLog.objects.filter(
        subscriber=subscriber
    ).order_by(
        "-id"
    )[:200]

    return Response(
        {
            "account": account,
            "messages": [
                {
                    "id": log.id,
                    "recipient": log.recipient,
                    "message": log.message,
                    "status": log.status,
                    "created_at": log.created_at,
                    "scheduled_for": log.scheduled_for,
                    "sent_at": log.sent_at,
                    "error": (
                        log.error_message if log.status == "FAILED" else ""
                    ),
                }
                for log in logs
            ],
        }
    )


@api_view(["POST"])
@authentication_classes([])
def api_cancel_message(request, log_id):
    """
    Lets an API-key client cancel one of its own SCHEDULED messages.
    """

    api_key = _extract_api_key(
        request
    )

    if not api_key:

        return Response(
            {
                "error": "api_key required"
            },
            status=400
        )

    key = ApiKey.objects.select_related(
        "subscriber"
    ).filter(
        api_key=api_key,
        enabled=True
    ).first()

    if key is None or not key.subscriber.active:

        return Response(
            {
                "error": "invalid api key"
            },
            status=403
        )

    log = SmsLog.objects.filter(
        id=log_id,
        subscriber=key.subscriber
    ).first()

    if log is None:

        return Response(
            {
                "error": "message not found"
            },
            status=404
        )

    cancelled = SmsLog.objects.filter(
        id=log.id,
        status="SCHEDULED"
    ).update(
        status="CANCELLED"
    )

    if not cancelled:

        return Response(
            {
                "error": "only scheduled messages can be cancelled"
            },
            status=409
        )

    return Response(
        {
            "status": "cancelled",
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

    try:
        scheduled_for = parse_scheduled_for(
            request.data.get("scheduled_for")
        )
    except ScheduleError as ex:
        return Response(
            {
                "error": str(ex)
            },
            status=400
        )

    contacts = _active_contacts_queryset(request.user)
    target_label = "contacts"

    if target_type in [
        "contact",
        "contacts",
    ]:
        contact_ids = request.data.get("contact_ids")

        # Keep accepting the original single-contact payload for existing
        # clients while the dashboard now sends a list of selected contacts.
        if contact_ids is None:
            contact_id = request.data.get("contact_id")
            contact_ids = [
                contact_id,
            ] if contact_id else []

        if not isinstance(contact_ids, list) or not contact_ids:
            return Response(
                {
                    "error": "contact_ids must be a non-empty list"
                },
                status=400
            )

        try:
            contact_ids = [
                int(contact_id)
                for contact_id in contact_ids
            ]
        except (TypeError, ValueError):
            return Response(
                {
                    "error": "contact_ids must contain valid contact IDs"
                },
                status=400
            )

        contacts = contacts.filter(
            id__in=contact_ids
        )
        target_label = (
            "contact"
            if len(set(contact_ids)) == 1
            else "selected contacts"
        )

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
    batch_id = uuid.uuid4() if scheduled_for is not None else None
    log_ids = []

    for contact in contacts:
        log = _queue_sms(
            subscriber=None,
            recipient=contact.mobile_number,
            message=message,
            sent_by=request.user,
            recipient_name=str(contact).strip(),
            scheduled_for=scheduled_for,
            batch_id=batch_id
        )
        log_ids.append(log.id)
        queued += 1

    if scheduled_for is not None:

        return Response(
            {
                "status": "scheduled",
                "target": target_label,
                "contacts": queued,
                "scheduled_for": scheduled_for,
                "batch_id": batch_id,
                "log_ids": log_ids
            }
        )

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
        batch_id = self.request.query_params.get("batch_id")
        ordering = self.request.query_params.get("ordering")

        if status_filter:
            queryset = queryset.filter(
                status=status_filter.upper()
            )

        if batch_id:
            try:
                queryset = queryset.filter(
                    batch_id=uuid.UUID(batch_id)
                )
            except ValueError:
                queryset = queryset.none()

        if ordering in (
            "scheduled_for",
            "-scheduled_for",
            "created_at",
            "-created_at",
        ):
            queryset = queryset.order_by(
                ordering,
                "id"
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

    @staticmethod
    def _queue_retry(log, policy):

        if log.status != "FAILED":
            return "Only failed messages can be retried.", status.HTTP_400_BAD_REQUEST

        if log.attempts > policy.max_retries:
            return (
                "This message has already used its "
                f"{policy.max_retries} allowed retry attempt(s).",
                status.HTTP_400_BAD_REQUEST,
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
            process_sms.delay(log.id)
        except Exception as ex:
            log.status = "FAILED"
            log.error_message = f"Could not queue retry: {ex}"
            log.response_message = log.error_message
            log.failure_category = "UNKNOWN"
            log.save()

            return log.error_message, status.HTTP_502_BAD_GATEWAY

        return None, None

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
        policy = SmsRetryPolicy.current()
        error, error_status = self._queue_retry(log, policy)

        if error:
            return Response(
                {"detail": error},
                status=error_status
            )

        return Response(
            self.get_serializer(log).data,
            status=status.HTTP_202_ACCEPTED
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="bulk-retry"
    )
    def bulk_retry(self, request):

        ids = request.data.get("ids")

        if not isinstance(ids, list) or not ids:
            return Response(
                {"detail": "ids must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            ids = list(dict.fromkeys(int(log_id) for log_id in ids))
        except (TypeError, ValueError):
            return Response(
                {"detail": "ids must contain valid message IDs."},
                status=status.HTTP_400_BAD_REQUEST
            )

        accessible_logs = {
            log.id: log
            for log in self.get_queryset().filter(id__in=ids)
        }
        policy = SmsRetryPolicy.current()
        retried_logs = []
        skipped = 0
        failed_to_queue = []

        for log_id in ids:
            log = accessible_logs.get(log_id)

            if not log:
                skipped += 1
                continue

            error, error_status = self._queue_retry(log, policy)

            if error:
                if error_status == status.HTTP_502_BAD_GATEWAY:
                    failed_to_queue.append(
                        {
                            "id": log.id,
                            "detail": error,
                        }
                    )
                else:
                    skipped += 1
                continue

            retried_logs.append(log)

        return Response(
            {
                "retried": len(retried_logs),
                "skipped": skipped,
                "failed_to_queue": failed_to_queue,
                "logs": self.get_serializer(
                    retried_logs,
                    many=True
                ).data,
            },
            status=status.HTTP_202_ACCEPTED
        )

    def _parse_ids(self, request):

        ids = request.data.get("ids")

        if not isinstance(ids, list) or not ids:
            return None, Response(
                {"detail": "ids must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            return list(dict.fromkeys(int(log_id) for log_id in ids)), None
        except (TypeError, ValueError):
            return None, Response(
                {"detail": "ids must contain valid message IDs."},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(
        detail=True,
        methods=["post"]
    )
    def cancel(self, request, pk=None):
        """
        Cancels one SCHEDULED message before it is sent. The status flip
        is a conditional UPDATE, so if the dispatcher releases the
        message at the same moment, exactly one of the two wins.
        """

        log = self.get_object()

        cancelled = SmsLog.objects.filter(
            id=log.id,
            status="SCHEDULED"
        ).update(
            status="CANCELLED"
        )

        if not cancelled:
            return Response(
                {"detail": "Only scheduled messages can be cancelled."},
                status=status.HTTP_400_BAD_REQUEST
            )

        log.refresh_from_db()

        return Response(
            self.get_serializer(log).data
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="bulk-cancel"
    )
    def bulk_cancel(self, request):
        """
        Cancels scheduled messages by `ids`, or a whole scheduled bulk
        send by `batch_id`. Messages that are not (or are no longer)
        SCHEDULED are skipped, not errors.
        """

        queryset = self.get_queryset().filter(
            status="SCHEDULED"
        )

        batch_id = request.data.get("batch_id")

        if batch_id:

            try:
                queryset = queryset.filter(
                    batch_id=uuid.UUID(str(batch_id))
                )
            except ValueError:
                return Response(
                    {"detail": "batch_id is not valid."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            requested = None

        else:

            ids, error_response = self._parse_ids(request)

            if error_response:
                return error_response

            queryset = queryset.filter(id__in=ids)
            requested = len(ids)

        cancelled = SmsLog.objects.filter(
            id__in=list(queryset.values_list("id", flat=True)),
            status="SCHEDULED"
        ).update(
            status="CANCELLED"
        )

        return Response(
            {
                "cancelled": cancelled,
                "skipped": (
                    requested - cancelled
                    if requested is not None else 0
                ),
            }
        )

    @action(
        detail=True,
        methods=["post"]
    )
    def reschedule(self, request, pk=None):
        """
        Moves one SCHEDULED message to a new time (`scheduled_for`).
        """

        log = self.get_object()

        try:
            scheduled_for = parse_scheduled_for(
                request.data.get("scheduled_for")
            )
        except ScheduleError as ex:
            return Response(
                {"detail": str(ex)},
                status=status.HTTP_400_BAD_REQUEST
            )

        if scheduled_for is None:
            return Response(
                {"detail": "scheduled_for is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        changed = SmsLog.objects.filter(
            id=log.id,
            status="SCHEDULED"
        ).update(
            scheduled_for=scheduled_for
        )

        if not changed:
            return Response(
                {"detail": "Only scheduled messages can be rescheduled."},
                status=status.HTTP_400_BAD_REQUEST
            )

        log.refresh_from_db()

        return Response(
            self.get_serializer(log).data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="send-now"
    )
    def send_now(self, request, pk=None):
        """
        Releases one SCHEDULED message immediately instead of waiting for
        its time.
        """

        log = self.get_object()

        if log.status != "SCHEDULED":
            return Response(
                {"detail": "Only scheduled messages can be sent now."},
                status=status.HTTP_400_BAD_REQUEST
            )

        release_scheduled_log(log.id)

        log.refresh_from_db()

        return Response(
            self.get_serializer(log).data,
            status=status.HTTP_202_ACCEPTED
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="bulk-delete"
    )
    def bulk_delete(self, request):

        ids = request.data.get("ids")

        if not isinstance(ids, list) or not ids:
            return Response(
                {"detail": "ids must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            ids = list(dict.fromkeys(int(log_id) for log_id in ids))
        except (TypeError, ValueError):
            return Response(
                {"detail": "ids must contain valid message IDs."},
                status=status.HTTP_400_BAD_REQUEST
            )

        deletable = self.get_queryset().filter(
            id__in=ids,
            status__in=[
                "SENT",
                "FAILED",
                "CANCELLED",
            ],
        )
        deleted = deletable.count()
        deletable.delete()

        return Response(
            {
                "deleted": deleted,
                "skipped": len(ids) - deleted,
            }
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


MODEM_STATUS_COOLDOWN_SECONDS = 25
MODEM_STATUS_REFRESH_SECONDS = 30
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
@permission_classes([CanSendSms])
def modem_status(request):
    """
    Read-only — returns whatever was last recorded, never touches the
    hardware. Safe to call on every page load/refresh.
    """

    return Response(
        {
            "cooldown_seconds": MODEM_STATUS_COOLDOWN_SECONDS,
            "refresh_interval_seconds": MODEM_STATUS_REFRESH_SECONDS,
            "modems": _serialize_modem_statuses(),
        }
    )


@api_view(["POST"])
@permission_classes([CanSendSms])
def modem_status_check(request):
    """
    Automatic, read-only signal refresh. It issues AT+CSQ against configured,
    previously-known, and newly enumerated serial ports, then stores the
    result for every dashboard. The cooldown prevents several open tabs from
    querying the same modem at once; the port lock prevents collision with an
    SMS send.
    """

    client = _redis_client()

    ttl = client.ttl(MODEM_STATUS_COOLDOWN_KEY)

    if ttl and ttl > 0:

        return Response(
            {
                "error": "Status check is on cooldown.",
                "retry_after_seconds": ttl,
                "cooldown_seconds": MODEM_STATUS_COOLDOWN_SECONDS,
                "refresh_interval_seconds": MODEM_STATUS_REFRESH_SECONDS,
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
                "refresh_interval_seconds": MODEM_STATUS_REFRESH_SECONDS,
                "modems": _serialize_modem_statuses(),
            },
            status=429
        )

    probe = Sim800Service()
    signal_ports = probe.signal_check_ports()

    # Do not run identity/setup commands against serial devices here. Every
    # enumerated port receives only one read-only AT+CSQ query; ports that do
    # not understand it are retained as unknown and never used for sending.
    for port in signal_ports:

        result = probe.check_signal(port)
        signal_csq = result["signal_csq"]
        responsive = result["responsive"]

        registration_detail = (
            "Modem responded to the automatic AT+CSQ signal query. "
            "Network registration is not queried by this refresh."
            if responsive
            else "No response to the automatic AT+CSQ signal query."
        )

        if result["error"]:
            registration_detail += f" {result['error']}"

        ModemStatus.objects.update_or_create(
            port=port,
            defaults={
                "is_online": responsive,
                "signal_csq": signal_csq,
                "signal_bucket": ModemStatus.bucket_for_csq(signal_csq),
                "registration_state": (
                    "UNKNOWN" if responsive else "NO_RESPONSE"
                ),
                "registration_detail": registration_detail,
                "last_checked_by": request.user,
            }
        )

    return Response(
        {
            "cooldown_seconds": MODEM_STATUS_COOLDOWN_SECONDS,
            "refresh_interval_seconds": MODEM_STATUS_REFRESH_SECONDS,
            "modems": _serialize_modem_statuses(),
        }
    )
