from rest_framework import serializers

from .models import ApiKey
from .models import SmsLog
from .models import Subscription
from .models import SmsRetryPolicy


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

    sent_by_name = serializers.SerializerMethodField()

    def get_subscriber_name(self, obj):

        if not obj.subscriber_id:
            return ""

        return obj.subscriber.user.username

    def get_sent_by_name(self, obj):

        if not obj.sent_by_id:
            return ""

        return f"{obj.sent_by.first_name} {obj.sent_by.last_name}".strip()

    class Meta:
        model = SmsLog
        fields = [
            "id",
            "subscriber",
            "subscriber_name",
            "sent_by",
            "sent_by_name",
            "recipient",
            "message",
            "status",
            "created_at",
            "sent_at",
            "error_message",
            "response_message",
            "attempts",
            "modem_port",
        ]
        read_only_fields = fields


class SmsRetryPolicySerializer(serializers.ModelSerializer):

    updated_by_name = serializers.SerializerMethodField()

    def get_updated_by_name(self, obj):

        if not obj.updated_by_id:
            return ""

        return f"{obj.updated_by.first_name} {obj.updated_by.last_name}".strip()

    def validate_max_retries(self, value):

        if value > 10:
            raise serializers.ValidationError(
                "max_retries can't exceed 10 — pick something more reasonable."
            )

        return value

    def validate_base_backoff_seconds(self, value):

        if value < 1:
            raise serializers.ValidationError(
                "base_backoff_seconds must be at least 1."
            )

        return value

    def validate_backoff_multiplier(self, value):

        if value < 1:
            raise serializers.ValidationError(
                "backoff_multiplier must be at least 1 (1 = no backoff growth)."
            )

        return value

    class Meta:
        model = SmsRetryPolicy
        fields = [
            "id",
            "max_retries",
            "base_backoff_seconds",
            "backoff_multiplier",
            "updated_at",
            "updated_by",
            "updated_by_name",
        ]
        read_only_fields = [
            "id",
            "updated_at",
            "updated_by",
            "updated_by_name",
        ]


class SubscriptionSerializer(serializers.ModelSerializer):

    subscriber_name = serializers.CharField(
        source="subscriber.user.username",
        read_only=True
    )
    plan_name = serializers.CharField(
        source="plan.plan_name",
        read_only=True
    )
    plan_type = serializers.CharField(
        source="plan.plan_type",
        read_only=True
    )
    plan_message_limit = serializers.IntegerField(
        source="plan.message_limit",
        read_only=True
    )

    def validate(self, attrs):

        status = attrs.get(
            "status",
            getattr(self.instance, "status", "ACTIVE")
        )

        subscriber = attrs.get(
            "subscriber",
            getattr(self.instance, "subscriber", None)
        )

        if status == "ACTIVE" and subscriber is not None:

            existing_active = Subscription.objects.filter(
                subscriber=subscriber,
                status="ACTIVE"
            )

            if self.instance:
                existing_active = existing_active.exclude(
                    id=self.instance.id
                )

            if existing_active.exists():

                raise serializers.ValidationError(
                    {
                        "subscriber": (
                            "This subscriber already has an active subscription. "
                            "Change their existing subscription's plan instead of "
                            "enrolling them again."
                        )
                    }
                )

        return attrs

    class Meta:
        model = Subscription
        fields = [
            "id",
            "subscriber",
            "subscriber_name",
            "plan",
            "plan_name",
            "plan_type",
            "plan_message_limit",
            "status",
        ]
