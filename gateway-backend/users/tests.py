from django.test import TestCase
from django.test import override_settings
from django.utils import timezone
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

    @override_settings(BROWSER_SESSION_CLOSE_GRACE_SECONDS=2)
    def test_last_tab_close_expires_the_device_session_after_grace(self):
        browser = APIClient()
        self.login(browser)

        close_response = browser.post("/api/device-session/closing/")
        self.assertEqual(close_response.status_code, 204)
        self.assertTrue(browser.get("/api/device-session/").data["active"])

        session = browser.session
        session["browser_closing_at"] = timezone.now().timestamp() - 3
        session.save()

        self.assertEqual(browser.get("/api/me/").status_code, 401)
        self.assertEqual(
            browser.get("/api/device-session/").data,
            {"active": False, "user_id": None},
        )

        next_login = browser.post(
            "/api/token/",
            {
                "username": self.other_user.username,
                "password": "pass12345",
            },
            format="json",
        )
        self.assertEqual(next_login.status_code, 200)

    def test_page_reload_can_resume_recently_closing_session(self):
        browser = APIClient()
        self.login(browser)

        browser.post("/api/device-session/closing/")
        resume_response = browser.post("/api/device-session/resume/")

        self.assertEqual(resume_response.status_code, 204)
        self.assertNotIn("browser_closing_at", browser.session)
        self.assertTrue(browser.get("/api/device-session/").data["active"])

    def test_super_admin_can_reset_department_admin_password(self):
        super_admin = User.objects.create_user(
            username="super-admin",
            email="super@example.com",
            password="pass12345",
            role="SUPER_ADMIN",
        )
        department_admin = User.objects.create_user(
            username="department-admin",
            email="department@example.com",
            password="pass12345",
            role="DEPARTMENT_ADMIN",
            is_ite_admin=True,
        )
        department_browser = APIClient()
        self.login(department_browser, department_admin)
        super_client = APIClient()
        super_client.force_authenticate(user=super_admin)

        response = super_client.post(
            f"/api/admin-accounts/{department_admin.pk}/reset-password/",
            {
                "new_password": "NewStrongPass!234",
                "confirm_password": "NewStrongPass!234",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        department_admin.refresh_from_db()
        self.assertTrue(department_admin.check_password("NewStrongPass!234"))
        self.assertEqual(department_browser.get("/api/me/").status_code, 401)

    def test_department_admin_can_reset_instructor_password(self):
        department_admin = User.objects.create_user(
            username="department-admin",
            email="department@example.com",
            password="pass12345",
            role="DEPARTMENT_ADMIN",
            is_ite_admin=True,
        )
        admin_client = APIClient()
        admin_client.force_authenticate(user=department_admin)

        response = admin_client.post(
            f"/api/instructors/{self.user.pk}/reset-password/",
            {
                "new_password": "FreshSecure!726",
                "confirm_password": "FreshSecure!726",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("FreshSecure!726"))

        instructor_client = APIClient()
        instructor_client.force_authenticate(user=self.user)
        forbidden = instructor_client.post(
            f"/api/instructors/{self.other_user.pk}/reset-password/",
            {
                "new_password": "NotAllowed!234",
                "confirm_password": "NotAllowed!234",
            },
            format="json",
        )
        self.assertEqual(forbidden.status_code, 403)

    def test_instructor_can_change_own_password_and_is_signed_out(self):
        browser = APIClient()
        self.login(browser)

        wrong_current = browser.post(
            "/api/change-password/",
            {
                "current_password": "incorrect",
                "new_password": "OwnNewPassword!234",
                "confirm_password": "OwnNewPassword!234",
            },
            format="json",
        )
        self.assertEqual(wrong_current.status_code, 400)

        response = browser.post(
            "/api/change-password/",
            {
                "current_password": "pass12345",
                "new_password": "OwnNewPassword!234",
                "confirm_password": "OwnNewPassword!234",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("OwnNewPassword!234"))
        self.assertEqual(browser.get("/api/me/").status_code, 401)

    def test_department_admin_can_change_own_password(self):
        department_admin = User.objects.create_user(
            username="department-admin",
            email="department@example.com",
            password="pass12345",
            role="DEPARTMENT_ADMIN",
            is_ite_admin=True,
        )
        browser = APIClient()
        self.login(browser, department_admin)

        response = browser.post(
            "/api/change-password/",
            {
                "current_password": "pass12345",
                "new_password": "VioletHarbor!726",
                "confirm_password": "VioletHarbor!726",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        department_admin.refresh_from_db()
        self.assertTrue(department_admin.check_password("VioletHarbor!726"))
