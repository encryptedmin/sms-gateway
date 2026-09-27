from datetime import date
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from contacts.models import Contact
from contacts.models import ContactGroup
from plans.models import Plan
from subscribers.models import Subscriber
from users.models import User

from .models import ApiKey
from .models import SmsLog


class GatewayApiTests(TestCase):

    def setUp(self):

        self.client = APIClient()
        self.user = User.objects.create_user(
            username="subscriber",
            email="subscriber@example.com",
            password="pass12345",
            first_name="Sub",
            last_name="Scriber",
            role="SUBSCRIBER",
        )
        self.subscriber = Subscriber.objects.create(
            user=self.user,
            start_date=date.today()
        )
        self.api_key = ApiKey.objects.create(
            subscriber=self.subscriber
        )

    @patch("gateway.views.process_sms.delay")
    def test_send_sms_accepts_bearer_api_key(self, delay):

        response = self.client.post(
            "/api/send-sms/",
            {
                "recipient": "09123456789",
                "message": "Class is suspended.",
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_key.api_key}",
        )

        self.assertEqual(
            response.status_code,
            200
        )
        self.assertEqual(
            response.data["status"],
            "queued"
        )
        self.assertEqual(
            SmsLog.objects.count(),
            1
        )
        delay.assert_called_once()

    def test_authenticated_user_can_list_plans(self):

        Plan.objects.create(
            plan_name="Monthly",
            description="Monthly SMS package",
            price=500,
            payment_type="monthly",
        )

        self.client.force_authenticate(
            user=self.user
        )

        response = self.client.get(
            "/api/plans/"
        )

        self.assertEqual(
            response.status_code,
            200
        )
        self.assertEqual(
            response.data[0]["plan_name"],
            "Monthly"
        )

    def test_contact_csv_import_adds_contacts_to_group(self):

        admin = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="pass12345",
            first_name="Admin",
            last_name="User",
            role="DEPARTMENT_ADMIN",
        )
        group = ContactGroup.objects.create(
            name="Instructors"
        )
        upload = SimpleUploadedFile(
            "contacts.csv",
            (
                b"first_name,last_name,mobile_number,course,year_level\n"
                b"Ana,Reyes,09999999999,BSIT,4\n"
            ),
            content_type="text/csv",
        )

        self.client.force_authenticate(
            user=admin
        )

        response = self.client.post(
            "/api/contacts/import-csv/",
            {
                "file": upload,
                "group_id": group.id,
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            200
        )
        self.assertEqual(
            response.data["created"],
            1
        )

        contact = Contact.objects.get(
            mobile_number="09999999999"
        )
        self.assertTrue(
            contact.groups.filter(
                id=group.id
            ).exists()
        )

    @patch("gateway.views.process_sms.delay")
    def test_send_sms_rejects_malformed_recipient(self, delay):
        """
        Sim800Service.send_sms interpolates the recipient directly into
        an AT+CMGS="<recipient>" modem command with no escaping. A
        recipient carrying a quote/CR could inject arbitrary AT commands
        into the modem session, so this must be rejected before a
        SmsLog is ever queued.
        """

        response = self.client.post(
            "/api/send-sms/",
            {
                "recipient": '09123456789"; AT+CFUN=1;\r',
                "message": "hi",
            },
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_key.api_key}",
        )

        self.assertEqual(
            response.status_code,
            400
        )
        self.assertEqual(
            SmsLog.objects.count(),
            0
        )
        delay.assert_not_called()
