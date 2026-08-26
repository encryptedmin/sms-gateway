import secrets
from django.db import models
from subscribers.models import Subscriber
from plans.models import Plan
from django.conf import settings


class Subscription(models.Model):

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

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["subscriber"],
                condition=models.Q(status="ACTIVE"),
                name="one_active_subscription_per_subscriber"
            )
        ]

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