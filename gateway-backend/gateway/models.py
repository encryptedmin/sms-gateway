import secrets
from django.db import models
from subscribers.models import Subscriber
from plans.models import Plan


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
        ("SENT", "SENT"),
        ("FAILED", "FAILED"),
    ]

    subscriber = models.ForeignKey(
        Subscriber,
        on_delete=models.CASCADE,
        null=True,
        blank=True
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

    def __str__(self):
        return self.recipient
    
