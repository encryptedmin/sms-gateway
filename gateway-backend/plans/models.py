from django.db import models


class Plan(models.Model):

    PLAN_TYPE = [
        ("UNLIMITED", "UNLIMITED"),
        ("LIMITED", "LIMITED"),
    ]

    plan_name = models.CharField(
        max_length=100
    )

    description = models.TextField()

    price = models.FloatField()

    payment_type = models.CharField(
        max_length=50
    )

    plan_type = models.CharField(
        max_length=20,
        choices=PLAN_TYPE,
        default="UNLIMITED"
    )

    message_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text=(
            "Messages allowed per billing period for LIMITED plans "
            "(resets each period once usage enforcement is wired up). "
            "Ignored for UNLIMITED plans."
        )
    )

    def __str__(self):
        if self.plan_type == "LIMITED":
            return f"{self.plan_name} ({self.message_limit}/period)"
        return f"{self.plan_name} (Unlimited)"