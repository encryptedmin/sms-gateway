from contextlib import nullcontext
from datetime import date
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from contacts.models import Contact
from contacts.models import ContactGroup
from contacts.serializers import ContactGroupSerializer
from plans.models import Plan
from subscribers.models import Subscriber
from users.models import User

from .models import ApiKey
from .models import SmsLog
from .models import Subscription
from .models import ModemStatus


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

    def test_group_reports_only_active_contacts_for_send_estimate(self):
        group = ContactGroup.objects.create(name="BSIT 1A")
        active_contact = Contact.objects.create(
            first_name="Active",
            mobile_number="09171111111",
            active=True,
        )
        inactive_contact = Contact.objects.create(
            first_name="Inactive",
            mobile_number="09172222222",
            active=False,
        )
        active_contact.groups.add(group)
        inactive_contact.groups.add(group)

        data = ContactGroupSerializer(group).data

        self.assertEqual(data["contact_count"], 2)
        self.assertEqual(data["active_contact_count"], 1)

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

    @patch("gateway.services.time.sleep")
    @patch("gateway.services.serial.Serial")
    def test_signal_probe_sends_only_at_csq(self, serial_class, sleep):
        from .services import Sim800Service

        serial_connection = serial_class.return_value
        serial_connection.is_open = True
        service = Sim800Service()

        with patch.object(
            service,
            "_modem_lock",
            return_value=nullcontext(),
        ), patch.object(
            service,
            "_send_command",
            return_value="+CSQ: 18,0\r\nOK",
        ) as send_command:
            result = service.check_signal("COM3")

        send_command.assert_called_once_with(
            serial_connection,
            "AT+CSQ",
            timeout=5,
        )
        self.assertTrue(result["responsive"])
        self.assertEqual(result["signal_csq"], 18)
        serial_connection.close.assert_called_once_with()


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

    @patch("gateway.views.process_sms.delay")
    def test_instructor_can_send_to_multiple_selected_contacts(self, delay):
        first_contact = Contact.objects.create(
            first_name="First",
            mobile_number="09171111111",
            owner=self.instructor,
        )
        second_contact = Contact.objects.create(
            first_name="Second",
            mobile_number="09172222222",
            owner=self.instructor,
        )
        inaccessible_contact = Contact.objects.create(
            first_name="Private",
            mobile_number="09173333333",
            owner=self.other_instructor,
        )

        response = self.client.post(
            "/api/department/send-sms/",
            {
                "target_type": "contacts",
                "contact_ids": [
                    first_contact.id,
                    second_contact.id,
                    inaccessible_contact.id,
                ],
                "message": "Class is suspended.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["contacts"], 2)
        self.assertEqual(response.data["target"], "selected contacts")
        self.assertSetEqual(
            set(
                SmsLog.objects.filter(
                    message="Class is suspended."
                ).values_list("recipient", flat=True)
            ),
            {
                first_contact.mobile_number,
                second_contact.mobile_number,
            },
        )
        self.assertEqual(delay.call_count, 2)

    def test_multiple_contact_send_requires_a_non_empty_id_list(self):
        response = self.client.post(
            "/api/department/send-sms/",
            {
                "target_type": "contacts",
                "contact_ids": [],
                "message": "Class is suspended.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["error"],
            "contact_ids must be a non-empty list",
        )

    @patch("gateway.views._redis_client")
    @patch("gateway.views.Sim800Service")
    def test_automatic_signal_refresh_uses_signal_only_probe(
        self,
        service_class,
        redis_client,
    ):
        redis_client.return_value.ttl.return_value = 0
        redis_client.return_value.set.return_value = True
        service = service_class.return_value
        service.signal_check_ports.return_value = ["COM3"]
        service.check_signal.return_value = {
            "responsive": True,
            "signal_csq": 21,
            "raw": "+CSQ: 21,0\r\nOK",
            "error": "",
        }

        response = self.client.post("/api/modem-status/check/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["refresh_interval_seconds"], 30)
        self.assertEqual(response.data["modems"][0]["signal_csq"], 21)
        service.signal_check_ports.assert_called_once_with()
        service.check_signal.assert_called_once_with("COM3")
        service.discover_all_modem_ports.assert_not_called()
        modem = ModemStatus.objects.get(port="COM3")
        self.assertTrue(modem.is_online)
        self.assertEqual(modem.signal_bucket, "EXCELLENT")
