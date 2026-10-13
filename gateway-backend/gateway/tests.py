import uuid
from contextlib import nullcontext
from datetime import date
from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
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
from .tasks import dispatch_due_scheduled_sms
from .tasks import process_sms


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

    def test_identity_check_accepts_only_sim800c(self):
        from .services import Sim800Service

        service = Sim800Service()

        self.assertTrue(service._looks_like_sim800("SIMCOM_SIM800C\r\nOK"))
        self.assertTrue(service._looks_like_sim800("Model: SIM800C-DS"))
        self.assertFalse(service._looks_like_sim800("SIMCOM_Ltd\r\nOK"))
        self.assertFalse(service._looks_like_sim800("SIM800L\r\nOK"))
        self.assertFalse(service._looks_like_sim800("Quectel EC25\r\nOK"))

    def test_sms_dispatch_uses_only_verified_responsive_cached_modems(self):
        from .services import Sim800Service

        ModemStatus.objects.create(
            port="COM3",
            is_online=False,
        )
        ModemStatus.objects.create(
            port="COM6",
            is_online=True,
            is_verified_sim800c=True,
        )
        ModemStatus.objects.create(
            port="COM7",
            is_online=True,
            is_verified_sim800c=True,
        )
        ModemStatus.objects.create(
            port="COM8",
            is_online=True,
            is_verified_sim800c=False,
        )

        service = Sim800Service()

        self.assertEqual(
            service.preferred_ports,
            [
                "COM6",
                "COM7",
            ],
        )

    @patch("gateway.tasks.Sim800Service")
    def test_consecutive_messages_are_split_between_two_modems(
        self,
        service_class,
    ):
        from .tasks import _pick_modem_port

        service_class.return_value.detected_ports.return_value = [
            "COM6",
            "COM7",
        ]

        self.assertEqual(
            [
                _pick_modem_port(log_id)
                for log_id in [100, 101, 102, 103]
            ],
            [
                "COM6",
                "COM7",
                "COM6",
                "COM7",
            ],
        )


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
                "scheduled_messages": 0,
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

    @patch("gateway.views.process_sms.delay")
    def test_instructor_can_bulk_retry_only_their_own_failed_messages(
        self,
        delay,
    ):
        own_failed = next(log for log in self.own_logs if log.status == "FAILED")

        response = self.client.post(
            "/api/logs/bulk-retry/",
            {
                "ids": [
                    own_failed.id,
                    self.other_log.id,
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["retried"], 1)
        self.assertEqual(response.data["skipped"], 1)
        own_failed.refresh_from_db()
        self.other_log.refresh_from_db()
        self.assertEqual(own_failed.status, "PENDING")
        self.assertEqual(self.other_log.status, "FAILED")
        delay.assert_called_once_with(own_failed.id)

    def test_instructor_can_bulk_delete_only_their_completed_history(self):
        own_sent = next(log for log in self.own_logs if log.status == "SENT")
        own_pending = next(log for log in self.own_logs if log.status == "PENDING")

        response = self.client.post(
            "/api/logs/bulk-delete/",
            {
                "ids": [
                    own_sent.id,
                    own_pending.id,
                    self.other_log.id,
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["deleted"], 1)
        self.assertEqual(response.data["skipped"], 2)
        self.assertFalse(SmsLog.objects.filter(id=own_sent.id).exists())
        self.assertTrue(SmsLog.objects.filter(id=own_pending.id).exists())
        self.assertTrue(SmsLog.objects.filter(id=self.other_log.id).exists())

    def test_instructor_can_view_only_active_verified_sim800c_modules(self):
        ModemStatus.objects.create(
            port="COM3",
            is_online=True,
            is_verified_sim800c=True,
        )
        ModemStatus.objects.create(
            port="COM4",
            is_online=True,
            is_verified_sim800c=False,
        )
        ModemStatus.objects.create(
            port="COM5",
            is_online=False,
            is_verified_sim800c=True,
        )

        response = self.client.get("/api/modem-status/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [modem["port"] for modem in response.data["modems"]],
            ["COM3"],
        )
        self.assertTrue(response.data["modems"][0]["verified_sim800c"])

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
        self.assertSetEqual(
            set(
                SmsLog.objects.filter(
                    message="Class is suspended."
                ).values_list("recipient_name", flat=True)
            ),
            {
                "First",
                "Second",
            },
        )

        logs_response = self.client.get("/api/logs/")
        sent_rows = [
            row
            for row in logs_response.data
            if row["message"] == "Class is suspended."
        ]
        self.assertSetEqual(
            {row["recipient_name"] for row in sent_rows},
            {
                "First",
                "Second",
            },
        )
        self.assertTrue(
            all(row["sent_by_name"] == "Instructor One" for row in sent_rows)
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
    def test_automatic_signal_refresh_discovers_only_verified_sim800c(
        self,
        service_class,
        redis_client,
    ):
        stale_modem = ModemStatus.objects.create(
            port="COM9",
            is_online=True,
            is_verified_sim800c=True,
        )
        redis_client.return_value.ttl.return_value = 0
        redis_client.return_value.set.return_value = True
        service = service_class.return_value
        service.discover_all_modem_ports.return_value = ["COM3"]
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
        self.assertTrue(response.data["modems"][0]["verified_sim800c"])
        self.assertEqual(
            [modem["port"] for modem in response.data["modems"]],
            ["COM3"],
        )
        service.discover_all_modem_ports.assert_called_once_with()
        service.check_signal.assert_called_once_with("COM3")
        modem = ModemStatus.objects.get(port="COM3")
        self.assertTrue(modem.is_online)
        self.assertTrue(modem.is_verified_sim800c)
        self.assertEqual(modem.signal_bucket, "EXCELLENT")
        stale_modem.refresh_from_db()
        self.assertFalse(stale_modem.is_online)


class ScheduledSmsTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.instructor = User.objects.create_user(
            username="sched-instructor",
            email="sched1@example.com",
            password="pass12345",
            first_name="Sched",
            last_name="One",
            role="INSTRUCTOR",
        )
        self.other_instructor = User.objects.create_user(
            username="sched-other",
            email="sched2@example.com",
            password="pass12345",
            first_name="Sched",
            last_name="Two",
            role="INSTRUCTOR",
        )
        self.subscriber_user = User.objects.create_user(
            username="sched-subscriber",
            email="sched3@example.com",
            password="pass12345",
            role="SUBSCRIBER",
        )
        self.subscriber = Subscriber.objects.create(
            user=self.subscriber_user,
            start_date=date.today(),
        )
        self.api_key = ApiKey.objects.create(subscriber=self.subscriber)
        self.plan = Plan.objects.create(
            plan_name="Unlimited",
            description="test",
            price=0,
            payment_type="test",
            plan_type="UNLIMITED",
        )
        self.subscription = Subscription.objects.create(
            subscriber=self.subscriber,
            plan=self.plan,
        )

    def future(self, **delta):
        return (timezone.now() + timedelta(**delta)).isoformat()

    def make_log(self, minutes_from_now, **fields):
        fields.setdefault("sent_by", self.instructor)
        fields.setdefault("recipient", "09171234567")
        fields.setdefault("message", "Scheduled")
        return SmsLog.objects.create(
            status="SCHEDULED",
            scheduled_for=timezone.now() + timedelta(minutes=minutes_from_now),
            **fields,
        )

    def send_api(self, **body):
        return self.client.post(
            "/api/send-sms/",
            {"recipient": "09171234567", "message": "Hi", **body},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {self.api_key.api_key}",
        )

    # ---- creating schedules

    @patch("gateway.views.process_sms.delay")
    def test_department_send_can_be_scheduled_as_one_batch(self, delay):
        for number in ("09171111111", "09172222222"):
            Contact.objects.create(
                first_name=number[-2:],
                mobile_number=number,
                owner=self.instructor,
            )
        self.client.force_authenticate(user=self.instructor)

        response = self.client.post(
            "/api/department/send-sms/",
            {
                "target_type": "all",
                "message": "Exam moved.",
                "scheduled_for": self.future(hours=2),
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "scheduled")
        self.assertEqual(response.data["contacts"], 2)
        delay.assert_not_called()

        logs = SmsLog.objects.filter(status="SCHEDULED")
        self.assertEqual(logs.count(), 2)
        self.assertEqual(
            {str(batch) for batch in logs.values_list("batch_id", flat=True)},
            {str(response.data["batch_id"])},
        )
        self.assertEqual(
            sorted(response.data["log_ids"]),
            sorted(logs.values_list("id", flat=True)),
        )
        self.assertTrue(all(log.scheduled_for for log in logs))

    @patch("gateway.views.process_sms.delay")
    def test_invalid_schedule_times_are_rejected_without_creating_anything(self, delay):
        Contact.objects.create(
            first_name="A",
            mobile_number="09171111111",
            owner=self.instructor,
        )
        self.client.force_authenticate(user=self.instructor)

        for bad in (
            "not a date",
            self.future(hours=-3),
            self.future(days=400),
        ):
            response = self.client.post(
                "/api/department/send-sms/",
                {"target_type": "all", "message": "x", "scheduled_for": bad},
                format="json",
            )
            self.assertEqual(response.status_code, 400, bad)
            self.assertIn("scheduled_for", response.data["error"])

        self.assertEqual(SmsLog.objects.count(), 0)
        delay.assert_not_called()

    @patch("gateway.views.process_sms.delay")
    def test_blank_schedule_still_sends_immediately(self, delay):
        response = self.send_api(scheduled_for="")

        self.assertEqual(response.data["status"], "queued")
        delay.assert_called_once()

    @patch("gateway.views.process_sms.delay")
    def test_api_key_send_can_be_scheduled(self, delay):
        response = self.send_api(scheduled_for=self.future(hours=1))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "scheduled")
        delay.assert_not_called()
        log = SmsLog.objects.get(id=response.data["log_id"])
        self.assertEqual(log.status, "SCHEDULED")
        self.assertEqual(log.subscriber, self.subscriber)

    @patch("gateway.views.process_sms.delay")
    def test_scheduling_still_requires_quota_remaining(self, delay):
        limited = Plan.objects.create(
            plan_name="Tiny",
            description="test",
            price=0,
            payment_type="test",
            plan_type="LIMITED",
            message_limit=1,
        )
        self.subscription.plan = limited
        self.subscription.messages_sent_this_period = 1
        self.subscription.save()

        response = self.send_api(scheduled_for=self.future(hours=1))

        self.assertEqual(response.status_code, 429)
        self.assertEqual(SmsLog.objects.count(), 0)

    # ---- dispatching

    @patch("gateway.tasks.process_sms.delay")
    def test_dispatcher_releases_only_due_messages_and_only_once(self, delay):
        due = self.make_log(-1)
        later = self.make_log(60)

        self.assertEqual(dispatch_due_scheduled_sms(), 1)

        due.refresh_from_db()
        later.refresh_from_db()
        self.assertEqual(due.status, "PENDING")
        self.assertEqual(later.status, "SCHEDULED")
        delay.assert_called_once_with(due.id)

        # A second tick must not queue the same message again.
        self.assertEqual(dispatch_due_scheduled_sms(), 0)
        delay.assert_called_once()

    @patch("gateway.tasks.process_sms.delay")
    def test_dispatcher_releases_oldest_first_and_respects_batch_size(self, delay):
        newer = self.make_log(-1)
        older = self.make_log(-30)

        self.assertEqual(dispatch_due_scheduled_sms(batch_size=1), 1)

        older.refresh_from_db()
        newer.refresh_from_db()
        self.assertEqual(older.status, "PENDING")
        self.assertEqual(newer.status, "SCHEDULED")

    @patch("gateway.tasks.process_sms.delay")
    def test_cancelled_message_is_never_released(self, delay):
        log = self.make_log(-1)
        self.client.force_authenticate(user=self.instructor)

        response = self.client.post(f"/api/logs/{log.id}/cancel/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "CANCELLED")
        self.assertFalse(response.data["can_cancel"])
        self.assertEqual(dispatch_due_scheduled_sms(), 0)
        delay.assert_not_called()

    @patch("gateway.tasks.process_sms.delay")
    def test_release_fails_message_when_account_can_no_longer_send(self, delay):
        log = self.make_log(-1, subscriber=self.subscriber, sent_by=None)
        self.subscriber.active = False
        self.subscriber.save()

        self.assertEqual(dispatch_due_scheduled_sms(), 0)

        log.refresh_from_db()
        self.assertEqual(log.status, "FAILED")
        self.assertEqual(log.failure_category, "ACCOUNT_BLOCKED")
        self.assertIn("inactive", log.error_message)
        delay.assert_not_called()

    @patch("gateway.tasks.process_sms.delay", side_effect=Exception("broker down"))
    def test_release_marks_failed_when_the_queue_is_unreachable(self, delay):
        log = self.make_log(-1)

        self.assertEqual(dispatch_due_scheduled_sms(), 0)

        log.refresh_from_db()
        self.assertEqual(log.status, "FAILED")
        self.assertIn("broker down", log.error_message)

    @patch("gateway.tasks.send_sms_with_hard_timeout")
    def test_worker_task_never_sends_scheduled_or_cancelled_messages(self, send):
        scheduled = self.make_log(60)
        cancelled = self.make_log(60)
        SmsLog.objects.filter(id=cancelled.id).update(status="CANCELLED")

        self.assertFalse(process_sms(scheduled.id))
        self.assertFalse(process_sms(cancelled.id))

        send.assert_not_called()
        scheduled.refresh_from_db()
        cancelled.refresh_from_db()
        self.assertEqual(scheduled.status, "SCHEDULED")
        self.assertEqual(cancelled.status, "CANCELLED")
        self.assertEqual(scheduled.attempts, 0)

    # ---- managing schedules

    @patch("gateway.tasks.process_sms.delay")
    def test_reschedule_and_send_now(self, delay):
        log = self.make_log(60)
        self.client.force_authenticate(user=self.instructor)

        new_time = self.future(hours=5)
        response = self.client.post(
            f"/api/logs/{log.id}/reschedule/",
            {"scheduled_for": new_time},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        log.refresh_from_db()
        self.assertGreater(log.scheduled_for, timezone.now() + timedelta(hours=4))

        self.assertEqual(
            self.client.post(
                f"/api/logs/{log.id}/reschedule/", {}, format="json"
            ).status_code,
            400,
        )

        response = self.client.post(f"/api/logs/{log.id}/send-now/")
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["status"], "PENDING")
        delay.assert_called_once_with(log.id)

        # No longer scheduled: every schedule action is refused.
        for action in ("cancel", "send-now"):
            self.assertEqual(
                self.client.post(f"/api/logs/{log.id}/{action}/").status_code, 400
            )
        self.assertEqual(
            self.client.post(
                f"/api/logs/{log.id}/reschedule/",
                {"scheduled_for": new_time},
                format="json",
            ).status_code,
            400,
        )

    def test_instructor_cannot_manage_another_instructors_schedule(self):
        theirs = self.make_log(60, sent_by=self.other_instructor)
        self.client.force_authenticate(user=self.instructor)

        for action in ("cancel", "send-now", "reschedule"):
            response = self.client.post(
                f"/api/logs/{theirs.id}/{action}/",
                {"scheduled_for": self.future(hours=2)},
                format="json",
            )
            self.assertEqual(response.status_code, 404, action)

        theirs.refresh_from_db()
        self.assertEqual(theirs.status, "SCHEDULED")

    def test_bulk_cancel_by_batch_or_ids_skips_what_is_not_scheduled(self):
        batch = uuid.uuid4()
        in_batch = [self.make_log(60, batch_id=batch) for _ in range(3)]
        other = self.make_log(60)
        sent = SmsLog.objects.create(
            sent_by=self.instructor, recipient="09170000000", message="x", status="SENT"
        )
        self.client.force_authenticate(user=self.instructor)

        response = self.client.post(
            "/api/logs/bulk-cancel/", {"batch_id": str(batch)}, format="json"
        )
        self.assertEqual(response.data["cancelled"], 3)
        self.assertEqual(
            SmsLog.objects.filter(
                id__in=[log.id for log in in_batch], status="CANCELLED"
            ).count(),
            3,
        )

        response = self.client.post(
            "/api/logs/bulk-cancel/", {"ids": [other.id, sent.id]}, format="json"
        )
        self.assertEqual(response.data, {"cancelled": 1, "skipped": 1})
        sent.refresh_from_db()
        self.assertEqual(sent.status, "SENT")

        self.assertEqual(
            self.client.post("/api/logs/bulk-cancel/", {}, format="json").status_code, 400
        )
        self.assertEqual(
            self.client.post(
                "/api/logs/bulk-cancel/", {"batch_id": "nope"}, format="json"
            ).status_code,
            400,
        )

    def test_cancelled_messages_can_be_bulk_deleted(self):
        log = self.make_log(60)
        SmsLog.objects.filter(id=log.id).update(status="CANCELLED")
        self.client.force_authenticate(user=self.instructor)

        response = self.client.post(
            "/api/logs/bulk-delete/", {"ids": [log.id]}, format="json"
        )

        self.assertEqual(response.data["deleted"], 1)

    def test_scheduled_list_filter_ordering_and_dashboard_count(self):
        late = self.make_log(300)
        soon = self.make_log(10)
        self.client.force_authenticate(user=self.instructor)

        response = self.client.get("/api/logs/?status=SCHEDULED&ordering=scheduled_for")

        self.assertEqual([row["id"] for row in response.data], [soon.id, late.id])
        self.assertTrue(all(row["can_cancel"] for row in response.data))
        self.assertTrue(all(row["scheduled_for"] for row in response.data))
        self.assertEqual(
            self.client.get("/api/dashboard/stats/").data["scheduled_messages"], 2
        )

    # ---- API-key clients

    def test_api_key_client_can_see_and_cancel_only_its_own_schedule(self):
        mine = self.make_log(60, subscriber=self.subscriber, sent_by=None)
        sent = SmsLog.objects.create(
            subscriber=self.subscriber, recipient="09170000000", message="x", status="SENT"
        )
        auth = {"HTTP_AUTHORIZATION": f"Bearer {self.api_key.api_key}"}

        listing = self.client.get("/api/messages/", **auth)
        row = next(m for m in listing.data["messages"] if m["id"] == mine.id)
        self.assertEqual(row["status"], "SCHEDULED")
        self.assertIsNotNone(row["scheduled_for"])

        # Someone else's message looks exactly like a missing one.
        theirs = self.make_log(60)
        self.assertEqual(
            self.client.post(f"/api/messages/{theirs.id}/cancel/", **auth).status_code, 404
        )
        self.assertEqual(
            self.client.post(f"/api/messages/{sent.id}/cancel/", **auth).status_code, 409
        )
        self.assertEqual(
            self.client.post(f"/api/messages/{mine.id}/cancel/").status_code, 400
        )
        self.assertEqual(
            self.client.post(
                f"/api/messages/{mine.id}/cancel/", HTTP_AUTHORIZATION="Bearer wrong"
            ).status_code,
            403,
        )

        response = self.client.post(f"/api/messages/{mine.id}/cancel/", **auth)
        self.assertEqual(response.status_code, 200)
        mine.refresh_from_db()
        self.assertEqual(mine.status, "CANCELLED")
