from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):

    ROLE_CHOICES = [
        ("SUPER_ADMIN", "Super Admin"),
        ("DEPARTMENT_ADMIN", "Department Admin"),
        ("INSTRUCTOR", "Instructor"),
        ("SUBSCRIBER", "Subscriber"),
    ]

    first_name = models.CharField(max_length=100)

    middle_name = models.CharField(
        max_length=100,
        blank=True
    )

    last_name = models.CharField(
        max_length=100
    )

    extension_name = models.CharField(
        max_length=50,
        blank=True
    )

    email = models.EmailField(
        unique=True
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="SUBSCRIBER"
    )

    is_ite_admin = models.BooleanField(
        default=False,
        help_text="Designates whether this user can login to the ITE admin dashboard."
    )

    is_ite_instructor = models.BooleanField(
        default=False,
        help_text="Designates whether this instructor belongs to the ITE department."
    )

    @property
    def is_super_admin(self):
        return self.role == "SUPER_ADMIN"


    @property
    def is_department_admin(self):
        return self.role == "DEPARTMENT_ADMIN"


    @property
    def is_instructor(self):
        return self.role == "INSTRUCTOR"


    @property
    def is_subscriber(self):
        return self.role == "SUBSCRIBER"

    @property
    def can_login_to_dashboard(self):
        """Only ITE admins, ITE instructors, or super admins can login."""
        return (
            self.role == "SUPER_ADMIN" or
            self.is_ite_admin or
            self.is_ite_instructor
        )

    def save(self, *args, **kwargs):

        if self.role == "DEPARTMENT_ADMIN":
            self.is_ite_admin = True
            self.is_ite_instructor = False

        elif self.role == "INSTRUCTOR":
            self.is_ite_admin = False
            self.is_ite_instructor = True

        elif self.role in [
            "SUPER_ADMIN",
            "SUBSCRIBER",
        ]:
            self.is_ite_admin = False
            self.is_ite_instructor = False

        super().save(*args, **kwargs)

    def __str__(self):
        return self.username
