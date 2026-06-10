import csv
import io

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from users.permissions import CanSendSms

from .models import Contact
from .models import ContactGroup
from .serializers import ContactGroupSerializer
from .serializers import ContactSerializer


class ContactGroupViewSet(ModelViewSet):

    queryset = ContactGroup.objects.all().order_by("name")
    serializer_class = ContactGroupSerializer
    permission_classes = [
        CanSendSms
    ]


class ContactViewSet(ModelViewSet):

    queryset = Contact.objects.prefetch_related("groups").all().order_by(
        "first_name",
        "last_name",
    )
    serializer_class = ContactSerializer
    permission_classes = [
        CanSendSms
    ]

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
