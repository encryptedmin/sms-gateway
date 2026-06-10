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
            role="DEPARTMENT_ADMIN"
        )
        user.set_password(
            password
        )
        user.save()

        return user
