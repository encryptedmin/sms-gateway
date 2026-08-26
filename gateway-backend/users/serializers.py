from rest_framework import serializers

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