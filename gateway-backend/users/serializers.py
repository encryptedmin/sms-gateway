from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import User


class EmailAccountMixin:
    """
    Email is the account identifier. It is stored lower-cased and must be
    unique ignoring case. `username` is never accepted as input; it mirrors
    the email and is exposed read-only (see User.save()).
    """

    def validate_email(self, value):

        email = value.strip().lower()

        taken = User.objects.filter(
            email__iexact=email
        )

        if self.instance is not None:
            taken = taken.exclude(
                pk=self.instance.pk
            )

        if taken.exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return email


class CurrentUserSerializer(serializers.ModelSerializer):

    username = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "middle_name",
            "last_name",
            "extension_name",
            "email",
            "role",
            "is_ite_admin",
            "is_ite_instructor",
        ]


class DepartmentAdminCreateSerializer(EmailAccountMixin, serializers.ModelSerializer):

    password = serializers.CharField(
        write_only=True
    )

    username = serializers.ReadOnlyField()

    class Meta:
        model = User
        extra_kwargs = {"email": {"validators": []}}
        fields = [
            "id",
            "username",
            "first_name",
            "middle_name",
            "last_name",
            "extension_name",
            "email",
            "password",
            "role",
            "is_ite_admin",
        ]
        read_only_fields = [
            "id",
            "role",
        ]

    def create(self, validated_data):

        password = validated_data.pop(
            "password"
        )

        user = User(
            **validated_data,
            role="DEPARTMENT_ADMIN",
            is_ite_admin=True  # Auto-set for ITE admin
        )
        user.set_password(
            password
        )
        user.save()

        return user


class InstructorCreateSerializer(EmailAccountMixin, serializers.ModelSerializer):

    password = serializers.CharField(
        write_only=True
    )

    username = serializers.ReadOnlyField()

    class Meta:
        model = User
        extra_kwargs = {"email": {"validators": []}}
        fields = [
            "id",
            "username",
            "first_name",
            "middle_name",
            "last_name",
            "extension_name",
            "email",
            "password",
            "role",
            "is_ite_instructor",
        ]
        read_only_fields = [
            "id",
            "role",
        ]

    def create(self, validated_data):

        password = validated_data.pop(
            "password"
        )

        user = User(
            **validated_data,
            role="INSTRUCTOR",
            is_ite_instructor=True  # Auto-set for ITE instructor
        )
        user.set_password(
            password
        )
        user.save()

        return user


class InstructorAccountSerializer(EmailAccountMixin, serializers.ModelSerializer):

    username = serializers.ReadOnlyField()

    class Meta:
        model = User
        extra_kwargs = {"email": {"validators": []}}
        fields = [
            "id",
            "username",
            "first_name",
            "middle_name",
            "last_name",
            "extension_name",
            "email",
            "role",
            "is_active",
            "is_ite_instructor",
        ]
        read_only_fields = [
            "id",
            "role",
            "is_ite_instructor",
        ]

class DepartmentAdminAccountSerializer(EmailAccountMixin, serializers.ModelSerializer):

    username = serializers.ReadOnlyField()

    class Meta:
        model = User
        extra_kwargs = {"email": {"validators": []}}
        fields = [
            "id",
            "username",
            "first_name",
            "middle_name",
            "last_name",
            "extension_name",
            "email",
            "role",
            "is_active",
            "is_ite_admin",
        ]
        read_only_fields = [
            "id",
            "role",
            "is_ite_admin",
        ]


class ResetPasswordSerializer(serializers.Serializer):

    new_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )
    confirm_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    def validate(self, attrs):

        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "The passwords do not match."}
            )

        try:
            validate_password(
                attrs["new_password"],
                user=self.context.get("user"),
            )
        except DjangoValidationError as ex:
            raise serializers.ValidationError(
                {"new_password": list(ex.messages)}
            ) from ex

        return attrs


class ChangePasswordSerializer(ResetPasswordSerializer):

    current_password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
    )

    def validate(self, attrs):

        user = self.context["user"]

        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError(
                {"current_password": "The current password is incorrect."}
            )

        return super().validate(attrs)
