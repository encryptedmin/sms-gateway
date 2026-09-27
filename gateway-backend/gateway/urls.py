from django.urls import path
from rest_framework.routers import DefaultRouter

from contacts.views import ContactGroupViewSet
from contacts.views import ContactViewSet
from contacts.views import MessageTemplateViewSet

from plans.views import PlanViewSet

from subscribers.views import SubscriberViewSet

from .views import (
    ApiKeyViewSet,
    SmsLogViewSet,
    SubscriptionViewSet,
    send_sms,
    department_send_sms,
    retry_policy,
    modem_status,
    modem_status_check
)

from .dashboard_views import (
    dashboard_stats
)

router = DefaultRouter()
router.register(
    "plans",
    PlanViewSet,
    basename="plan"
)
router.register(
    "subscribers",
    SubscriberViewSet,
    basename="subscriber"
)
router.register(
    "contact-groups",
    ContactGroupViewSet,
    basename="contact-group"
)
router.register(
    "contacts",
    ContactViewSet,
    basename="contact"
)
router.register(
    "message-templates",
    MessageTemplateViewSet,
    basename="message-template"
)
router.register(
    "subscriptions",
    SubscriptionViewSet,
    basename="subscription"
)
router.register(
    "api-keys",
    ApiKeyViewSet,
    basename="api-key"
)
router.register(
    "logs",
    SmsLogViewSet,
    basename="sms-log"
)

urlpatterns = [

    path(
        "send-sms/",
        send_sms
    ),

    path(
        "department/send-sms/",
        department_send_sms
    ),

    path(
        "dashboard/stats/",
        dashboard_stats
    ),

    path(
        "retry-policy/",
        retry_policy
    ),

    path(
        "modem-status/",
        modem_status
    ),

    path(
        "modem-status/check/",
        modem_status_check
    ),

] + router.urls