from django.db import models
from django.conf import settings


class Subscriber(models.Model):

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    active = models.BooleanField(
        default=True
    )

    start_date = models.DateField()

    def __str__(self):
        return self.user.username