from rest_framework import serializers

from core.phone import normalize_phone_number

from .models import Contact
from .models import ContactGroup
from .models import MessageTemplate


class ContactGroupSerializer(serializers.ModelSerializer):

    owner_name = serializers.SerializerMethodField()

    can_manage = serializers.SerializerMethodField()

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
            "is_shared",
            "can_manage",
            "is_class",
            "adopted_groups",
            "contact_count",
            "created_at",
        ]
        read_only_fields = [
            "owner",
            "owner_name",
            "can_manage",
            "contact_count",
            "created_at",
        ]

    def get_owner_name(self, obj):

        if obj.owner:
            return f"{obj.owner.first_name} {obj.owner.last_name}".strip()

        return None

    def get_can_manage(self, obj):

        request = self.context.get("request")

        if not request:
            return False

        user = request.user

        if user.role == "SUPER_ADMIN":
            return True

        if obj.owner_id == user.id:
            return True

        return (
            user.role == "DEPARTMENT_ADMIN" and
            obj.owner_id is None
        )

    def get_contact_count(self, obj):

        return obj.get_all_contacts().count()

    def validate_name(self, value):

        request = self.context.get("request")

        owner = (
            request.user
            if request
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

    def validate_adopted_groups(self, value):

        request = self.context.get("request")

        if not request:
            return value

        user = request.user

        if user.role == "SUPER_ADMIN":
            return value

        allowed = ContactGroup.objects.filter(
            owner=user
        ) | ContactGroup.objects.filter(
            is_shared=True
        )

        if user.role == "DEPARTMENT_ADMIN":
            allowed = allowed | ContactGroup.objects.filter(
                owner__isnull=True
            )

        allowed_ids = set(
            allowed.values_list("id", flat=True)
        )

        for group in value:
            if group.id not in allowed_ids:
                raise serializers.ValidationError(
                    "You can only adopt groups you own or groups that are shared."
                )

        return value


class ContactSerializer(serializers.ModelSerializer):

    owner_name = serializers.SerializerMethodField()

    can_manage = serializers.SerializerMethodField()

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
            "owner",
            "owner_name",
            "is_shared",
            "can_manage",
            "active",
            "created_at",
        ]
        read_only_fields = [
            "owner",
            "owner_name",
            "can_manage",
            "created_at",
        ]

    def get_owner_name(self, obj):

        if obj.owner:
            return f"{obj.owner.first_name} {obj.owner.last_name}".strip()

        return None

    def get_can_manage(self, obj):

        request = self.context.get("request")

        if not request:
            return False

        user = request.user

        if user.role == "SUPER_ADMIN":
            return True

        if obj.owner_id == user.id:
            return True

        return (
            user.role == "DEPARTMENT_ADMIN" and
            obj.owner_id is None
        )

    def validate_mobile_number(self, value):

        try:
            return normalize_phone_number(value)
        except ValueError as ex:
            raise serializers.ValidationError(str(ex))

    def validate_groups(self, value):

        request = self.context.get("request")

        if not request:
            return value

        user = request.user

        if user.role == "SUPER_ADMIN":
            return value

        allowed = ContactGroup.objects.filter(
            owner=user
        )

        if user.role == "DEPARTMENT_ADMIN":
            allowed = allowed | ContactGroup.objects.filter(
                owner__isnull=True
            )

        allowed_ids = set(
            allowed.values_list("id", flat=True)
        )

        for group in value:
            if group.id not in allowed_ids:
                raise serializers.ValidationError(
                    "You can only assign contacts to groups you manage."
                )

        return value


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
