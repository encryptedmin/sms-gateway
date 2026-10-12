from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from .models import Contact
from .serializers import ContactSerializer


class MobileNumberValidationTests(TestCase):
    """
    Contact.mobile_number (and, by extension, gateway.SmsLog.recipient)
    eventually reaches Sim800Service.send_sms, which interpolates it
    directly into an AT+CMGS="<phone>" modem command with no escaping.
    These tests guard the two places a Contact's number can be set:
    ContactSerializer (normal create/edit) and the CSV importer.
    """

    def test_serializer_normalizes_common_formatting(self):

        serializer = ContactSerializer(
            data={
                "first_name": "Ana",
                "last_name": "Reyes",
                "mobile_number": "0917-123 (4567)",
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(
            serializer.validated_data["mobile_number"],
            "09171234567"
        )

    def test_serializer_rejects_injection_style_value(self):

        serializer = ContactSerializer(
            data={
                "first_name": "Bad",
                "last_name": "Actor",
                "mobile_number": '09171234567"; AT+CMGS="x',
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("mobile_number", serializer.errors)

    def test_serializer_rejects_non_digit_value(self):

        serializer = ContactSerializer(
            data={
                "first_name": "Bad",
                "last_name": "Actor",
                "mobile_number": "not-a-number",
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("mobile_number", serializer.errors)

    def test_csv_import_skips_invalid_numbers_and_normalizes_valid_ones(self):

        admin = User.objects.create_user(
            username="csvadmin",
            email="csvadmin@example.com",
            password="pass12345",
            first_name="CSV",
            last_name="Admin",
            role="DEPARTMENT_ADMIN",
        )

        csv_bytes = (
            b"first_name,last_name,mobile_number\n"
            b"Good,One,0917-123-4567\n"
            b'Bad,Injection,"0917""; AT+CMGS=""x""\r"\n'
            b"Bad,Letters,abcnotanumber\n"
        )

        upload = SimpleUploadedFile(
            "contacts.csv",
            csv_bytes,
            content_type="text/csv",
        )

        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post(
            "/api/contacts/import-csv/",
            {"file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], 1)
        self.assertEqual(response.data["invalid"], 2)

        self.assertEqual(
            list(Contact.objects.values_list("mobile_number", flat=True)),
            ["09171234567"]
        )


class OwnerScopedMobileNumberTests(TestCase):

    def setUp(self):

        self.first_instructor = User.objects.create_user(
            username="instructor-one",
            email="instructor-one@example.com",
            password="pass12345",
            first_name="First",
            last_name="Instructor",
            role="INSTRUCTOR",
        )
        self.second_instructor = User.objects.create_user(
            username="instructor-two",
            email="instructor-two@example.com",
            password="pass12345",
            first_name="Second",
            last_name="Instructor",
            role="INSTRUCTOR",
        )

    def test_different_instructors_can_save_same_private_mobile_number(self):

        payload = {
            "first_name": "Student",
            "last_name": "One",
            "mobile_number": "0917-123-4567",
            "is_shared": False,
        }

        first_client = APIClient()
        first_client.force_authenticate(user=self.first_instructor)
        first_response = first_client.post(
            "/api/contacts/",
            payload,
            format="json",
        )

        second_client = APIClient()
        second_client.force_authenticate(user=self.second_instructor)
        second_response = second_client.post(
            "/api/contacts/",
            payload,
            format="json",
        )

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 201)
        self.assertEqual(
            Contact.objects.filter(
                mobile_number="09171234567",
                is_shared=False,
            ).count(),
            2,
        )
        self.assertSetEqual(
            set(
                Contact.objects.filter(
                    mobile_number="09171234567"
                ).values_list("owner_id", flat=True)
            ),
            {
                self.first_instructor.id,
                self.second_instructor.id,
            },
        )

    def test_same_instructor_cannot_save_mobile_number_twice(self):

        Contact.objects.create(
            first_name="Existing",
            mobile_number="09171234567",
            owner=self.first_instructor,
            is_shared=False,
        )

        client = APIClient()
        client.force_authenticate(user=self.first_instructor)
        response = client.post(
            "/api/contacts/",
            {
                "first_name": "Duplicate",
                "mobile_number": "0917-123-4567",
                "is_shared": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("mobile_number", response.data)
        self.assertEqual(
            Contact.objects.filter(
                owner=self.first_instructor,
                mobile_number="09171234567",
            ).count(),
            1,
        )

    def test_csv_import_scopes_existing_mobile_number_to_instructor(self):

        Contact.objects.create(
            first_name="Private to First",
            mobile_number="09171234567",
            owner=self.first_instructor,
            is_shared=False,
        )

        upload = SimpleUploadedFile(
            "contacts.csv",
            (
                b"first_name,last_name,mobile_number\n"
                b"Private to Second,Student,0917-123-4567\n"
            ),
            content_type="text/csv",
        )

        client = APIClient()
        client.force_authenticate(user=self.second_instructor)
        response = client.post(
            "/api/contacts/import-csv/",
            {
                "file": upload,
                "is_shared": "false",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created"], 1)
        self.assertEqual(response.data["skipped"], 0)
        self.assertTrue(
            Contact.objects.filter(
                owner=self.second_instructor,
                mobile_number="09171234567",
                is_shared=False,
            ).exists()
        )
