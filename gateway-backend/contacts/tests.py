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
