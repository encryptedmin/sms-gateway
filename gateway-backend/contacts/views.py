import csv
import io
from django.db.models import Q
from users.permissions import CanManageContactGroup
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from users.permissions import CanSendSms

from .models import Contact
from .models import ContactGroup
from .models import MessageTemplate
from .serializers import ContactGroupSerializer
from .serializers import ContactSerializer
from .serializers import MessageTemplateSerializer


class ContactGroupViewSet(ModelViewSet):

    serializer_class = ContactGroupSerializer
    permission_classes = [
        CanManageContactGroup
    ]

    def get_queryset(self):

        user = self.request.user

        queryset = ContactGroup.objects.all().order_by("name")

        if user.role == "INSTRUCTOR":
            # instructors can see their own groups plus shared
            # department-wide groups (owner is null) so they can adopt
            # them into a class — but editing is still locked down by
            # CanManageContactGroup's object-level check.
            queryset = queryset.filter(
                Q(owner=user) | Q(owner__isnull=True)
            )

        mine_only = self.request.query_params.get("mine")

        if mine_only and mine_only.lower() in ["1", "true", "yes"]:
            queryset = queryset.filter(owner=user)

        return queryset.distinct()

    def perform_create(self, serializer):

        owner = (
            self.request.user
            if self.request.user.role == "INSTRUCTOR"
            else None
        )

        serializer.save(owner=owner)


class ContactViewSet(ModelViewSet):

    queryset = Contact.objects.prefetch_related("groups").all().order_by(
        "first_name",
        "last_name",
    )
    serializer_class = ContactSerializer
    permission_classes = [
        CanSendSms
    ]

    def get_queryset(self):

        queryset = Contact.objects.prefetch_related("groups").all().order_by(
            "first_name",
            "last_name",
        )

        year_level = self.request.query_params.get("year_level")
        section = self.request.query_params.get("section")
        group_id = self.request.query_params.get("group_id")
        active = self.request.query_params.get("active")
        mine_only = self.request.query_params.get("mine")

        if year_level:
            queryset = queryset.filter(
                year_level__iexact=year_level
            )

        if section:
            queryset = queryset.filter(
                section__iexact=section
            )

        if group_id:
            queryset = queryset.filter(
                groups__id=group_id
            )

        if active is not None:
            queryset = queryset.filter(
                active=active.lower() in [
                    "1",
                    "true",
                    "yes",
                ]
            )

        if mine_only and mine_only.lower() in ["1", "true", "yes"]:
            # contacts belonging to ANY group owned by the requesting
            # instructor — lets an instructor's "Contacts" page show only
            # people relevant to them, not the whole department directory.
            queryset = queryset.filter(
                groups__owner=self.request.user
            )

        return queryset.distinct()

    @action(
        detail=False,
        methods=[
            "post",
        ],
        url_path="import-csv"
    )
    def import_csv(self, request):

        upload = request.FILES.get("file")

        if not upload:
            return Response(
                {
                    "error": "file required"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        group_id = request.data.get("group_id")
        group = None

        if group_id:

            try:
                group = ContactGroup.objects.get(
                    id=group_id
                )

            except ContactGroup.DoesNotExist:
                return Response(
                    {
                        "error": "group not found"
                    },
                    status=status.HTTP_404_NOT_FOUND
                )

        decoded = upload.read().decode(
            "utf-8-sig"
        )
        reader = csv.DictReader(
            io.StringIO(decoded)
        )

        created = 0
        updated = 0
        skipped = 0

        for row in reader:

            mobile_number = (
                row.get("mobile_number")
                or row.get("phone")
                or row.get("contact_number")
                or ""
            ).strip()

            first_name = (
                row.get("first_name")
                or row.get("name")
                or row.get("full_name")
                or ""
            ).strip()

            if not mobile_number or not first_name:
                skipped += 1
                continue

            contact, was_created = Contact.objects.update_or_create(
                mobile_number=mobile_number,
                defaults={
                    "first_name": first_name,
                    "last_name": (
                        row.get("last_name")
                        or ""
                    ).strip(),
                    "course": (
                        row.get("course")
                        or ""
                    ).strip(),
                    "year_level": (
                        row.get("year_level")
                        or row.get("year")
                        or ""
                    ).strip(),
                    "section": (
                        row.get("section")
                        or row.get("class_section")
                        or ""
                    ).strip(),
                    "active": True,
                }
            )

            if group:
                contact.groups.add(
                    group
                )

            if was_created:
                created += 1
            else:
                updated += 1

        return Response(
            {
                "created": created,
                "updated": updated,
                "skipped": skipped,
            }
        )


    @action(
        detail=False,
        methods=[
            "post",
        ],
        url_path="bulk-delete"
    )
    def bulk_delete(self, request):

        ids = request.data.get("ids")

        if not isinstance(ids, list) or not ids:
            return Response(
                {
                    "error": "ids (non-empty list) required"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        deleted_count, _ = Contact.objects.filter(
            id__in=ids
        ).delete()

        return Response(
            {
                "deleted": deleted_count
            }
        )

    @action(
        detail=False,
        methods=[
            "post",
        ],
        url_path="bulk-deactivate"
    )
    def bulk_deactivate(self, request):

        ids = request.data.get("ids")

        if not isinstance(ids, list) or not ids:
            return Response(
                {
                    "error": "ids (non-empty list) required"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        updated = Contact.objects.filter(
            id__in=ids
        ).update(
            active=False
        )

        return Response(
            {
                "updated": updated
            }
        )


class MessageTemplateViewSet(ModelViewSet):

    queryset = MessageTemplate.objects.select_related(
        "created_by"
    ).all()
    serializer_class = MessageTemplateSerializer
    permission_classes = [
        CanSendSms
    ]

    def perform_create(self, serializer):

        serializer.save(
            created_by=self.request.user
        )