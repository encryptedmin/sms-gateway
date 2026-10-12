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
from .models import Subscription


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

        plan = Plan.objects.create(
            plan_name="Gateway access",
            description="Unlimited test plan",
            price=0,
            payment_type="test",
            plan_type="UNLIMITED",
        )
        Subscription.objects.create(
            subscriber=self.subscriber,
            plan=plan,
        )

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


class InstructorSmsIsolationTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.instructor = User.objects.create_user(
            username="instructor-one",
            email="one@example.com",
            password="pass12345",
            first_name="Instructor",
            last_name="One",
            role="INSTRUCTOR",
        )
        self.other_instructor = User.objects.create_user(
            username="instructor-two",
            email="two@example.com",
            password="pass12345",
            first_name="Instructor",
            last_name="Two",
            role="INSTRUCTOR",
        )
        self.own_logs = [
            SmsLog.objects.create(
                sent_by=self.instructor,
                recipient=f"0912345678{index}",
                message=f"Own message {index}",
                status=status,
                error_message="Temporary failure" if status == "FAILED" else "",
            )
            for index, status in enumerate(["SENT", "PENDING", "FAILED"])
        ]
        self.other_log = SmsLog.objects.create(
            sent_by=self.other_instructor,
            recipient="09999999999",
            message="Another instructor's message",
            status="FAILED",
            error_message="Temporary failure",
        )
        self.client.force_authenticate(user=self.instructor)

    def test_history_and_status_counts_only_include_the_current_instructor(self):
        logs_response = self.client.get("/api/logs/")
        stats_response = self.client.get("/api/dashboard/stats/")

        self.assertEqual(logs_response.status_code, 200)
        self.assertSetEqual(
            {row["id"] for row in logs_response.data},
            {log.id for log in self.own_logs},
        )
        self.assertEqual(
            stats_response.data,
            {
                "total_messages": 3,
                "sent_messages": 1,
                "failed_messages": 1,
                "pending_messages": 1,
            },
        )

    @patch("gateway.views.process_sms.delay")
    def test_instructor_can_retry_only_their_own_failed_message(self, delay):
        own_failed = next(log for log in self.own_logs if log.status == "FAILED")

        own_response = self.client.post(f"/api/logs/{own_failed.id}/retry/")
        other_response = self.client.post(f"/api/logs/{self.other_log.id}/retry/")

        self.assertEqual(own_response.status_code, 202)
        self.assertEqual(other_response.status_code, 404)
        own_failed.refresh_from_db()
        self.assertEqual(own_failed.status, "PENDING")
        delay.assert_called_once_with(own_failed.id)

    def test_instructor_can_view_the_modem_signal_indicator(self):
        response = self.client.get("/api/modem-status/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("modems", response.data)
