from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from .models import User


class CurrentUserSerializer(serializers.ModelSerializer):

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


class DepartmentAdminCreateSerializer(serializers.ModelSerializer):

    password = serializers.CharField(
        write_only=True
    )

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


class InstructorCreateSerializer(serializers.ModelSerializer):

    password = serializers.CharField(
        write_only=True
    )

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


class InstructorAccountSerializer(serializers.ModelSerializer):

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
            "is_active",
            "is_ite_instructor",
        ]
        read_only_fields = [
            "id",
            "role",
            "is_ite_instructor",
        ]

class DepartmentAdminAccountSerializer(serializers.ModelSerializer):

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
