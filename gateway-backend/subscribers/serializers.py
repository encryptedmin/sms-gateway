from datetime import date

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from users.models import User

from .models import Subscriber


class UserSummarySerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
        ]


class SubscriberSerializer(serializers.ModelSerializer):

    user = UserSummarySerializer(read_only=True)

    class Meta:
        model = Subscriber
        fields = [
            "id",
            "user",
            "active",
            "start_date",
        ]


class SubscriberRegisterSerializer(serializers.Serializer):

    username = serializers.CharField(
        max_length=150
    )

    password = serializers.CharField(
        write_only=True,
        min_length=8
    )

    first_name = serializers.CharField(
        max_length=100
    )

    middle_name = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default=""
    )

    last_name = serializers.CharField(
        max_length=100
    )

    extension_name = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
        default=""
    )

    email = serializers.EmailField()

    def validate_username(self, value):

        if User.objects.filter(
            username__iexact=value
        ).exists():

            raise serializers.ValidationError(
                "This username is already taken."
            )

        return value

    def validate_email(self, value):

        if User.objects.filter(
            email__iexact=value
        ).exists():

            raise serializers.ValidationError(
                "This email is already registered."
            )

        return value

    def validate_password(self, value):

        validate_password(value)

        return value

    def create(self, validated_data):

        password = validated_data.pop(
            "password"
        )

        user = User(
            **validated_data,
            role="SUBSCRIBER"
        )
        user.set_password(
            password
        )
        user.save()

        return Subscriber.objects.create(
            user=user,
            start_date=date.today(),
            active=True
        )
