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

    def __str__(self):
        return self.username
