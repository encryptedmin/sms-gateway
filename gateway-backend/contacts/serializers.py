from rest_framework import serializers

from .models import Contact
from .models import ContactGroup
from .models import MessageTemplate


class ContactGroupSerializer(serializers.ModelSerializer):

    owner_name = serializers.SerializerMethodField()

    contact_count = serializers.SerializerMethodField()

    adopted_groups = serializers.PrimaryKeyRelatedField(
        many=True,
        required=False,
        queryset=ContactGroup.objects.all()
    )

    class Meta:
        model = ContactGroup
        fields = [
            "id",
            "name",
            "description",
            "owner",
            "owner_name",
            "is_class",
            "adopted_groups",
            "contact_count",
            "created_at",
        ]
        read_only_fields = [
            "owner",
            "owner_name",
            "contact_count",
            "created_at",
        ]

    def get_owner_name(self, obj):

        if obj.owner:
            return f"{obj.owner.first_name} {obj.owner.last_name}".strip()

        return None

    def get_contact_count(self, obj):

        return obj.get_all_contacts().count()

    def validate_name(self, value):

        request = self.context.get("request")

        owner = (
            request.user
            if (request and request.user.role == "INSTRUCTOR")
            else None
        )

        queryset = ContactGroup.objects.filter(
            name__iexact=value,
            owner=owner
        )

        if self.instance:
            queryset = queryset.exclude(id=self.instance.id)

        if queryset.exists():
            message = (
                "You already have a group with this name."
                if owner
                else "A group with this name already exists."
            )
            raise serializers.ValidationError(message)

        return value


class ContactSerializer(serializers.ModelSerializer):

    class Meta:
        model = Contact
        fields = [
            "id",
            "first_name",
            "last_name",
            "mobile_number",
            "course",
            "year_level",
            "section",
            "groups",
            "active",
            "created_at",
        ]
        read_only_fields = [
            "created_at",
        ]


class MessageTemplateSerializer(serializers.ModelSerializer):

    created_by_name = serializers.CharField(
        source="created_by.username",
        read_only=True
    )

    class Meta:
        model = MessageTemplate
        fields = [
            "id",
            "title",
            "content",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
