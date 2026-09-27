from rest_framework import serializers

from .models import ApiKey
from .models import SmsLog
from .models import Subscription
from .models import SmsRetryPolicy
from .sms_errors import classify_failure


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

    failure_category_label = serializers.SerializerMethodField()

    def get_failure_category_label(self, obj):
        """
        Human label for obj.failure_category ("Likely no credit / barred",
        etc). Falls back to re-classifying error_message on the fly for
        rows saved before failure_category existed, so old FAILED rows
        still show a reason instead of going blank.
        """

        if obj.failure_category:
            return obj.get_failure_category_display()

        if obj.status == "FAILED" and obj.error_message:

            category, _ = classify_failure(obj.error_message)

            return dict(SmsLog._meta.get_field("failure_category").choices).get(
                category,
                ""
            )

        return ""

    can_retry = serializers.SerializerMethodField()

    def get_can_retry(self, obj):
        """
        Whether the Retry button should be usable for this row. Reads
        the SmsRetryPolicy passed in via the viewset's
        get_serializer_context() (fetched once per request/list rather
        than once per row); falls back to a fresh lookup if this
        serializer is ever used somewhere that doesn't set that
        context.
        """

        if obj.status != "FAILED":
            return False

        policy = self.context.get("retry_policy") or SmsRetryPolicy.current()

        return obj.attempts <= policy.max_retries

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
            "failure_category",
            "failure_category_label",
            "can_retry",
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
    messages_remaining = serializers.SerializerMethodField()

    def get_messages_remaining(self, obj):

        if obj.plan.plan_type != "LIMITED":
            return None

        limit = obj.plan.message_limit or 0

        return max(
            0,
            limit - obj.current_usage()
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

    def update(self, instance, validated_data):

        plan_changed = (
            "plan" in validated_data
            and validated_data["plan"].id != instance.plan_id
        )

        instance = super().update(
            instance,
            validated_data
        )

        if plan_changed:

            # A different plan means a different (or no) cap — usage
            # against the old plan's limit isn't meaningful anymore, so
            # they start the new plan with a full, fresh quota.

            instance.reset_usage()

        return instance

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
            "messages_sent_this_period",
            "messages_remaining",
            "period_start",
            "status",
        ]
        read_only_fields = [
            "messages_sent_this_period",
            "period_start",
        ]
