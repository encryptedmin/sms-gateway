from rest_framework import serializers

from .models import Contact
from .models import ContactGroup
from .models import MessageTemplate


class ContactGroupSerializer(serializers.ModelSerializer):

    class Meta:
        model = ContactGroup
        fields = [
            "id",
            "name",
            "description",
            "created_at",
        ]
        read_only_fields = [
            "created_at",
        ]


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
