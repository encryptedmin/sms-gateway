from django.db import models


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