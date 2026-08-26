from django.db import models
from django.conf import settings


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
