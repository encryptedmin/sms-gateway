from django.db import models
from django.conf import settings


class ContactGroup(models.Model):

    name = models.CharField(
        max_length=100,
        unique=True
    )

    description = models.TextField(
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):

        return self.name


class Contact(models.Model):

    first_name = models.CharField(
        max_length=100
    )

    last_name = models.CharField(
        max_length=100,
        blank=True
    )

    mobile_number = models.CharField(
        max_length=20,
        unique=True
    )

    course = models.CharField(
        max_length=100,
        blank=True
    )

    year_level = models.CharField(
        max_length=50,
        blank=True
    )

    section = models.CharField(
        max_length=50,
        blank=True
    )

    groups = models.ManyToManyField(
        ContactGroup,
        blank=True
    )

    active = models.BooleanField(
        default=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):

        return (
            f"{self.first_name} "
            f"{self.last_name}"
        )


class MessageTemplate(models.Model):

    title = models.CharField(
        max_length=120
    )

    content = models.TextField()

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = [
            "title",
        ]

    def __str__(self):

        return self.title
