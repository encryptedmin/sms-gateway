from django.urls import path
from rest_framework.routers import DefaultRouter

from contacts.views import ContactGroupViewSet
from contacts.views import ContactViewSet

from plans.views import PlanViewSet

from subscribers.views import SubscriberViewSet

from .views import (
    ApiKeyViewSet,
    SmsLogViewSet,
    SubscriptionViewSet,
    send_sms,
    broadcast_sms
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
        "broadcast/",
        broadcast_sms
    ),

    path(
        "dashboard/stats/",
        dashboard_stats
    ),

] + router.urls
