from django.core.exceptions import ValidationError
from django.db import models
from django.conf import settings

from core.phone import normalize_phone_number


def validate_mobile_number(value):
    """
    Model-level backstop so a bad number can't get in even via a route
    that bypasses ContactSerializer (Django admin, a future management
    command, direct ORM use, etc). The serializer is still what
    normalizes the value that actually gets saved; this just refuses to
    let anything invalid through at the database layer.
    """

    try:
        normalize_phone_number(value)
    except ValueError as ex:
        raise ValidationError(str(ex))


class ContactGroup(models.Model):

    name = models.CharField(
        max_length=100
    )

    description = models.TextField(
        blank=True
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="owned_contact_groups"
    )

    is_shared = models.BooleanField(
        default=False
    )

    is_class = models.BooleanField(
        default=False
    )

    adopted_groups = models.ManyToManyField(
        "self",
        symmetrical=False,
        blank=True,
        related_name="adopted_by"
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def get_all_contacts(self):

        contact_ids = set(
            self.contact_set.values_list("id", flat=True)
        )

        for adopted in self.adopted_groups.all():
            contact_ids.update(
                adopted.contact_set.values_list("id", flat=True)
            )

        return Contact.objects.filter(
            id__in=contact_ids
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
        unique=True,
        validators=[validate_mobile_number]
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

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="owned_contacts"
    )

    is_shared = models.BooleanField(
        default=False
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
