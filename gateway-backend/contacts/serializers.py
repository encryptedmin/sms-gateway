from rest_framework import serializers

from .models import Contact
from .models import ContactGroup


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
            "groups",
            "active",
            "created_at",
        ]
        read_only_fields = [
            "created_at",
        ]
