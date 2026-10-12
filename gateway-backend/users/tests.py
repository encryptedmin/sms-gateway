from django.test import TestCase
from rest_framework.test import APIClient

from .models import User


class SingleSessionAuthenticationTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="instructor",
            email="instructor@example.com",
            password="pass12345",
            first_name="Ina",
            last_name="Structor",
            role="INSTRUCTOR",
        )
        self.other_user = User.objects.create_user(
            username="other-instructor",
            email="other-instructor@example.com",
            password="pass12345",
            first_name="Other",
            last_name="Instructor",
            role="INSTRUCTOR",
        )

    def login(self, client, user=None):
        user = user or self.user
        response = client.post(
            "/api/token/",
            {
                "username": user.username,
                "password": "pass12345",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {response.data['access']}"
        )
        return response.data

    def test_same_browser_cannot_login_to_another_account(self):
        browser = APIClient()
        self.login(browser)

        second_login = browser.post(
            "/api/token/",
            {
                "username": self.other_user.username,
                "password": "pass12345",
            },
            format="json",
        )

        self.assertEqual(second_login.status_code, 400)
        self.assertIn("already has an active login", str(second_login.data))
        self.assertEqual(browser.get("/api/me/").status_code, 200)

    def test_different_devices_can_login_to_the_same_account(self):
        first_device = APIClient()
        second_device = APIClient()
        first_tokens = self.login(first_device)
        second_tokens = self.login(second_device)

        self.assertEqual(first_device.get("/api/me/").status_code, 200)
        self.assertEqual(second_device.get("/api/me/").status_code, 200)
        self.assertEqual(
            first_device.post(
                "/api/token/refresh/",
                {"refresh": first_tokens["refresh"]},
                format="json",
            ).status_code,
            200,
        )
        self.assertEqual(
            second_device.post(
                "/api/token/refresh/",
                {"refresh": second_tokens["refresh"]},
                format="json",
            ).status_code,
            200,
        )

    def test_token_cannot_be_used_without_its_browser_session_cookie(self):
        original_browser = APIClient()
        tokens = self.login(original_browser)
        another_browser = APIClient()
        another_browser.credentials(
            HTTP_AUTHORIZATION=f"Bearer {tokens['access']}"
        )

        self.assertEqual(another_browser.get("/api/me/").status_code, 401)

    def test_logout_ends_only_the_current_device_session(self):
        first_device = APIClient()
        second_device = APIClient()
        first_tokens = self.login(first_device)
        self.login(second_device)

        response = first_device.post(
            "/api/logout/",
            {"refresh": first_tokens["refresh"]},
            format="json",
        )

        self.assertEqual(response.status_code, 204)
        self.assertEqual(first_device.get("/api/me/").status_code, 401)
        self.assertEqual(second_device.get("/api/me/").status_code, 200)
        self.assertEqual(
            first_device.post(
                "/api/token/refresh/",
                {"refresh": first_tokens["refresh"]},
                format="json",
            ).status_code,
            401,
        )

    def test_device_session_reports_the_browser_login(self):
        browser = APIClient()
        self.assertEqual(
            browser.get("/api/device-session/").data,
            {"active": False, "user_id": None},
        )

        self.login(browser)

        self.assertEqual(
            browser.get("/api/device-session/").data,
            {"active": True, "user_id": self.user.pk},
        )
