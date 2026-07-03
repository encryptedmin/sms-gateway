from rest_framework import serializers

from .models import ApiKey
from .models import SmsLog
from .models import Subscription


class ApiKeySerializer(serializers.ModelSerializer):

    subscriber_name = serializers.CharField(
        source="subscriber.user.username",
        read_only=True
    )

    class Meta:
        model = ApiKey
        fields = [
            "id",
            "subscriber",
            "subscriber_name",
            "api_key",
            "enabled",
            "created_at",
        ]
        read_only_fields = [
            "api_key",
            "created_at",
        ]


class SmsLogSerializer(serializers.ModelSerializer):

    subscriber_name = serializers.SerializerMethodField()

    def get_subscriber_name(self, obj):

        if not obj.subscriber_id:
            return ""

        return obj.subscriber.user.username

    class Meta:
        model = SmsLog
        fields = [
            "id",
            "subscriber",
            "subscriber_name",
            "recipient",
            "message",
            "status",
            "created_at",
            "sent_at",
            "error_message",
            "response_message",
        ]
        read_only_fields = fields


class SubscriptionSerializer(serializers.ModelSerializer):

    subscriber_name = serializers.CharField(
        source="subscriber.user.username",
        read_only=True
    )
    plan_name = serializers.CharField(
        source="plan.plan_name",
        read_only=True
    )

    class Meta:
        model = Subscription
        fields = [
            "id",
            "subscriber",
            "subscriber_name",
            "plan",
            "plan_name",
            "status",
        ]
