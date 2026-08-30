import secrets
from datetime import date
from datetime import timedelta
from django.db import models
from django.db.models import F
from subscribers.models import Subscriber
from plans.models import Plan
from django.conf import settings


class Subscription(models.Model):

    # A "period" for a LIMITED plan's message_limit is a rolling window
    # of this many days from period_start, not a calendar month — avoids
    # 28/30/31-day edge cases. Adjust here if the board wants calendar-
    # month billing instead.
    PERIOD_LENGTH_DAYS = 30

    subscriber = models.ForeignKey(
        Subscriber,
        on_delete=models.CASCADE
    )

    plan = models.ForeignKey(
        Plan,
        on_delete=models.CASCADE
    )

    STATUS = [
        ("ACTIVE", "ACTIVE"),
        ("INACTIVE", "INACTIVE"),
    ]

    status = models.CharField(
        max_length=20,
        choices=STATUS,
        default="ACTIVE"
    )

    messages_sent_this_period = models.PositiveIntegerField(
        default=0,
        help_text="Successful sends counted against the plan's message_limit, for the current period only."
    )

    period_start = models.DateField(
        default=date.today,
        help_text="Start of the current usage period. Rolls forward automatically once PERIOD_LENGTH_DAYS elapses."
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["subscriber"],
                condition=models.Q(status="ACTIVE"),
                name="one_active_subscription_per_subscriber"
            )
        ]

    def _period_has_elapsed(self):

        return date.today() >= self.period_start + timedelta(
            days=self.PERIOD_LENGTH_DAYS
        )

    def reset_usage(self):
        """
        Zeroes out usage and starts a fresh period as of today. Called
        whenever a subscriber is enrolled or switched onto a (possibly
        new) plan, so they always start with their full quota.
        """

        self.messages_sent_this_period = 0
        self.period_start = date.today()
        self.save(
            update_fields=[
                "messages_sent_this_period",
                "period_start",
            ]
        )

    def current_usage(self):
        """
        Returns messages_sent_this_period for the CURRENT period,
        transparently rolling the period forward (and zeroing usage) in
        the DB first if it has elapsed. Read this instead of the raw
        field whenever "how much have they used" matters.
        """

        if self._period_has_elapsed():

            self.messages_sent_this_period = 0
            self.period_start = date.today()
            self.save(
                update_fields=[
                    "messages_sent_this_period",
                    "period_start",
                ]
            )

        return self.messages_sent_this_period

    def has_quota_remaining(self):
        """
        True for UNLIMITED plans. For LIMITED plans, rolls the period
        forward if needed, then checks the fresh count against the
        plan's message_limit.
        """

        if self.plan.plan_type != "LIMITED":
            return True

        limit = self.plan.message_limit or 0

        return self.current_usage() < limit

    def record_successful_send(self):
        """
        Call once a message actually sends successfully. Only meaningful
        for LIMITED plans — UNLIMITED plans don't track usage. Uses an
        atomic DB-level increment (F expression) since two modems can
        record a send at the same instant.
        """

        if self.plan.plan_type != "LIMITED":
            return

        if self._period_has_elapsed():

            # Rare race: two sends could both observe an elapsed period
            # and both reset-to-1 here, undercounting by one at the exact
            # rollover boundary. Not worth the extra locking complexity
            # for a LAN system sending a handful of messages at a time.

            Subscription.objects.filter(
                id=self.id
            ).update(
                period_start=date.today(),
                messages_sent_this_period=1
            )

        else:

            Subscription.objects.filter(
                id=self.id
            ).update(
                messages_sent_this_period=F("messages_sent_this_period") + 1
            )

    def __str__(self):
        return f"{self.subscriber}"
    

class ApiKey(models.Model):

    subscriber = models.OneToOneField(
        Subscriber,
        on_delete=models.CASCADE
    )

    api_key = models.CharField(
        max_length=100,
        unique=True,
        editable=False
    )

    enabled = models.BooleanField(
        default=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def save(self, *args, **kwargs):

        if not self.api_key:
            self.api_key = secrets.token_hex(32)

        super().save(*args, **kwargs)

    def __str__(self):
        return self.subscriber.user.username
    
class SmsLog(models.Model):

    STATUS = [
        ("PENDING", "PENDING"),
        ("RETRYING", "RETRYING"),
        ("SENT", "SENT"),
        ("FAILED", "FAILED"),
    ]

    subscriber = models.ForeignKey(
        Subscriber,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sms_logs_sent"
    )

    recipient = models.CharField(
        max_length=20
    )

    message = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=STATUS,
        default="PENDING"
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    sent_at = models.DateTimeField(
        null=True,
        blank=True
    )

    error_message = models.TextField(
        blank=True
    )

    response_message = models.TextField(
    blank=True
    )

    attempts = models.PositiveIntegerField(
        default=0,
        help_text="How many send attempts have been made so far, including the current one."
    )

    modem_port = models.CharField(
        max_length=20,
        blank=True,
        help_text="The modem/COM port the most recent attempt was dispatched to."
    )

    def __str__(self):
        return self.recipient


class SmsRetryPolicy(models.Model):
    """
    Singleton row controlling how gateway.tasks.process_sms retries a
    failed send. Editable by SUPER_ADMIN via /api/retry-policy/ so retry
    behaviour can be tuned without a redeploy.
    """

    max_retries = models.PositiveIntegerField(
        default=3,
        help_text="Number of retry attempts after the first failed send, before marking FAILED."
    )

    base_backoff_seconds = models.PositiveIntegerField(
        default=30,
        help_text="Delay before the first retry, in seconds."
    )

    backoff_multiplier = models.FloatField(
        default=2.0,
        help_text="Each subsequent retry waits base_backoff_seconds * (multiplier ^ attempt_number)."
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    @classmethod
    def current(cls):
        """
        Returns the single active policy row, creating a default one on
        first access so tasks always have something to read.
        """

        policy = cls.objects.first()

        if policy is None:
            policy = cls.objects.create()

        return policy

    def backoff_seconds(self, attempt_number):
        """
        attempt_number is 1 for the first retry, 2 for the second, etc.
        """

        return self.base_backoff_seconds * (
            self.backoff_multiplier ** (attempt_number - 1)
        )

    def __str__(self):
        return (
            f"max_retries={self.max_retries}, "
            f"base_backoff={self.base_backoff_seconds}s, "
            f"multiplier={self.backoff_multiplier}"
        )

