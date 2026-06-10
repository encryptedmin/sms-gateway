from django.db import models


class Plan(models.Model):

    plan_name = models.CharField(
        max_length=100
    )

    description = models.TextField()

    price = models.FloatField()

    payment_type = models.CharField(
        max_length=50
    )

    def __str__(self):
        return self.plan_name