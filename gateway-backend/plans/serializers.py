from rest_framework import serializers

from .models import Plan


class PlanSerializer(serializers.ModelSerializer):

    def validate(self, attrs):

        plan_type = attrs.get(
            "plan_type",
            getattr(self.instance, "plan_type", "UNLIMITED")
        )

        message_limit = attrs.get(
            "message_limit",
            getattr(self.instance, "message_limit", None)
        )

        if plan_type == "LIMITED":

            if not message_limit or message_limit <= 0:

                raise serializers.ValidationError(
                    {
                        "message_limit": "Required and must be greater than 0 for a LIMITED plan."
                    }
                )

        else:

            # UNLIMITED plans ignore any message_limit that was sent —
            # keep the stored data consistent with what the plan actually is.
            attrs["message_limit"] = None

        return attrs

    class Meta:
        model = Plan
        fields = [
            "id",
            "plan_name",
            "description",
            "price",
            "payment_type",
            "plan_type",
            "message_limit",
        ]