from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.models import BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """
    Accounts are identified by email. There is no separate username to
    choose: User.save() always sets `username` to the (lower-cased) email,
    so a `username=` argument is accepted for old call sites but ignored.
    """

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):

        if not email or not str(email).strip():
            raise ValueError("An email address is required.")

        extra_fields.pop("username", None)

        user = self.model(
            email=self.normalize_email(str(email).strip()),
            **extra_fields
        )
        user.password = make_password(password)
        user.save(using=self._db)

        return user

    def create_user(self, email=None, password=None, **extra_fields):

        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)

        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email=None, password=None, **extra_fields):

        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "SUPER_ADMIN")

        if extra_fields["is_staff"] is not True:
            raise ValueError("Superuser must have is_staff=True.")

        if extra_fields["is_superuser"] is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(email, password, **extra_fields)


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

    # max_length 150 so the email always fits in AbstractUser.username
    # (150), which mirrors it.
    email = models.EmailField(
        max_length=150,
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

    objects = UserManager()

    # The email is the login. `username` is kept only as a mirror of it
    # (see save()) so Django internals that expect the column keep working.
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = [
        "first_name",
        "last_name",
    ]

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

        self.email = (self.email or "").strip().lower()
        self.username = self.email

        update_fields = kwargs.get("update_fields")

        if update_fields is not None and "email" in update_fields:
            kwargs["update_fields"] = set(update_fields) | {"username"}

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
        return self.email
