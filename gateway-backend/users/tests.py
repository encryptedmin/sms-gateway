import os
from importlib import import_module
from unittest.mock import patch

from django.apps import apps as django_apps
from django.core.management import call_command
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
                "email": user.email,
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
                "email": self.other_user.email,
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
                "email": self.other_user.email,
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


class EmailAsUsernameTests(TestCase):
    """Email is the login; `username` only mirrors it and is never input."""

    def setUp(self):
        self.super_admin = User.objects.create_superuser(
            email="Root@Example.com",
            password="pass12345",
            first_name="Root",
            last_name="Admin",
        )
        self.dept_admin = User.objects.create_user(
            email="dept@example.com",
            password="pass12345",
            first_name="Dept",
            last_name="Admin",
            role="DEPARTMENT_ADMIN",
        )

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def login(self, identifier, password="pass12345"):
        return APIClient().post(
            "/api/token/",
            {"email": identifier, "password": password},
            format="json",
        )

    # ---- model / manager

    def test_username_is_always_the_lowercased_email(self):
        self.assertEqual(self.super_admin.email, "root@example.com")
        self.assertEqual(self.super_admin.username, "root@example.com")

        # An old-style username argument is ignored, not trusted.
        user = User.objects.create_user(
            username="legacy-name",
            email="New.Person@Example.com",
            password="pass12345",
            first_name="New",
            last_name="Person",
        )
        self.assertEqual(user.username, "new.person@example.com")

        user.email = "Renamed@Example.com"
        user.save()
        user.refresh_from_db()
        self.assertEqual(user.username, "renamed@example.com")

        user.email = "partial@example.com"
        user.save(update_fields=["email"])
        user.refresh_from_db()
        self.assertEqual(user.username, "partial@example.com")

    def test_an_email_is_required(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email="", password="pass12345")

    def test_createsuperuser_command_uses_email(self):
        with patch.dict(os.environ, {"DJANGO_SUPERUSER_PASSWORD": "pass12345"}):
            call_command(
                "createsuperuser",
                interactive=False,
                email="boss@example.com",
                first_name="Big",
                last_name="Boss",
            )

        boss = User.objects.get(email="boss@example.com")
        self.assertTrue(boss.is_superuser)
        self.assertEqual(boss.role, "SUPER_ADMIN")
        self.assertEqual(boss.username, "boss@example.com")

    # ---- login

    def test_login_with_email_ignores_case_and_spaces(self):
        for identifier in (
            "dept@example.com",
            "DEPT@Example.COM",
            "  dept@example.com ",
        ):
            response = self.login(identifier)
            self.assertEqual(response.status_code, 200, identifier)
            self.assertIn("access", response.data)
            APIClient().post("/api/logout/")

    def test_login_with_the_old_username_field_no_longer_works(self):
        response = APIClient().post(
            "/api/token/",
            {"username": "dept@example.com", "password": "pass12345"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_wrong_password_is_rejected(self):
        self.assertEqual(self.login("dept@example.com", "nope").status_code, 401)

    # ---- creating accounts

    def test_department_admin_is_created_from_email_without_username(self):
        response = self.client_for(self.super_admin).post(
            "/api/admin-accounts/",
            {
                "first_name": "Maria",
                "last_name": "Reyes",
                "email": "Maria.Reyes@Example.com",
                "password": "pass12345",
                "username": "ignored-name",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["email"], "maria.reyes@example.com")
        self.assertEqual(response.data["username"], "maria.reyes@example.com")
        self.assertEqual(self.login("MARIA.REYES@example.com").status_code, 200)
        self.assertFalse(User.objects.filter(username="ignored-name").exists())

    def test_instructor_is_created_from_email_without_username(self):
        response = self.client_for(self.dept_admin).post(
            "/api/instructors/",
            {
                "first_name": "Jose",
                "last_name": "Cruz",
                "email": "jose@example.com",
                "password": "pass12345",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["username"], "jose@example.com")
        self.assertEqual(User.objects.get(email="jose@example.com").role, "INSTRUCTOR")

    def test_subscriber_is_registered_from_email_without_username(self):
        response = self.client_for(self.super_admin).post(
            "/api/register/subscriber/",
            {
                "first_name": "Registrar",
                "last_name": "Office",
                "email": "Registrar@Example.com",
                "password": "StrongPass!234",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["user"]["email"], "registrar@example.com")
        self.assertEqual(response.data["user"]["username"], "registrar@example.com")

    def test_email_is_required_when_creating_accounts(self):
        client = self.client_for(self.super_admin)

        response = client.post(
            "/api/admin-accounts/",
            {"first_name": "A", "last_name": "B", "password": "pass12345"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

        response = client.post(
            "/api/admin-accounts/",
            {"first_name": "A", "last_name": "B", "email": "not-an-email", "password": "x"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_duplicate_emails_are_rejected_ignoring_case_everywhere(self):
        base = {"first_name": "A", "last_name": "B", "password": "StrongPass!234"}

        for url, actor in (
            ("/api/admin-accounts/", self.super_admin),
            ("/api/instructors/", self.dept_admin),
            ("/api/register/subscriber/", self.super_admin),
        ):
            response = self.client_for(actor).post(
                url, {**base, "email": "DEPT@example.com"}, format="json"
            )
            self.assertEqual(response.status_code, 400, url)
            self.assertIn("email", response.data, url)

        self.assertEqual(User.objects.filter(email__iexact="dept@example.com").count(), 1)

    # ---- editing accounts

    def test_changing_an_email_changes_the_login(self):
        instructor = User.objects.create_user(
            email="old@example.com",
            password="pass12345",
            first_name="In",
            last_name="Structor",
            role="INSTRUCTOR",
        )
        client = self.client_for(self.dept_admin)

        response = client.patch(
            f"/api/instructors/{instructor.pk}/",
            {"email": "New@Example.com", "username": "sneaky"},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["email"], "new@example.com")
        self.assertEqual(response.data["username"], "new@example.com")
        self.assertEqual(self.login("old@example.com").status_code, 401)
        self.assertEqual(self.login("new@example.com").status_code, 200)

    def test_cannot_change_an_email_to_one_already_in_use(self):
        instructor = User.objects.create_user(
            email="inst@example.com",
            password="pass12345",
            first_name="In",
            last_name="Structor",
            role="INSTRUCTOR",
        )
        client = self.client_for(self.dept_admin)

        taken = client.patch(
            f"/api/instructors/{instructor.pk}/",
            {"email": "DEPT@example.com"},
            format="json",
        )
        same = client.patch(
            f"/api/instructors/{instructor.pk}/",
            {"email": "inst@example.com", "first_name": "Renamed"},
            format="json",
        )

        self.assertEqual(taken.status_code, 400)
        self.assertEqual(same.status_code, 200)

    def test_current_user_endpoint_reports_email_and_mirrored_username(self):
        response = self.client_for(self.dept_admin).get("/api/me/")

        self.assertEqual(response.data["email"], "dept@example.com")
        self.assertEqual(response.data["username"], "dept@example.com")

    # ---- migrating existing accounts

    def test_data_migration_normalizes_existing_accounts(self):
        migration = import_module("users.migrations.0006_email_becomes_username")

        def raw(**fields):
            user = User.objects.create_user(
                email=fields.pop("seed"),
                password="pass12345",
                first_name="F",
                last_name="L",
            )
            User.objects.filter(pk=user.pk).update(**fields)
            return user.pk

        mixed = raw(seed="mixed@example.com", email="Mixed@Example.COM ", username="mixed")
        clash = raw(seed="clash-seed@example.com", email="mixed@example.com", username="clash")
        blank = raw(seed="blank-seed@example.com", email="", username="Old.Admin")
        # S1's old username is S2's new username: needs the parking pass.
        swap_b = raw(seed="swap-b@example.com", username="swap-b")
        swap_a = raw(seed="swap-a@example.com", username="swap-b@example.com")

        migration.email_becomes_username(django_apps, None)

        by_pk = {u.pk: u for u in User.objects.all()}
        self.assertEqual(by_pk[mixed].email, "mixed@example.com")
        self.assertEqual(by_pk[clash].email, f"mixed+{clash}@example.com")
        self.assertEqual(by_pk[blank].email, "old.admin@ite.local")
        self.assertEqual(by_pk[swap_a].username, "swap-a@example.com")
        self.assertEqual(by_pk[swap_b].username, "swap-b@example.com")
        self.assertEqual(by_pk[self.dept_admin.pk].email, "dept@example.com")
        for user in by_pk.values():
            self.assertEqual(user.username, user.email)
        self.assertEqual(len({u.email for u in by_pk.values()}), len(by_pk))
