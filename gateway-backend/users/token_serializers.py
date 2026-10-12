from uuid import uuid4

from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from rest_framework.exceptions import AuthenticationFailed
from rest_framework import serializers
from rest_framework_simplejwt.serializers import (
    TokenObtainSerializer,
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.settings import api_settings

from .session_state import expire_closed_browser_session


SESSION_ERROR = "This login does not belong to the active browser session."


class SingleSessionTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Allow one account per browser session while allowing other devices."""

    def validate(self, attrs):
        request = self.context["request"]

        expire_closed_browser_session(request)

        if request.session.get("login_session_id"):
            raise serializers.ValidationError(
                {
                    "detail": (
                        "This browser already has an active login. "
                        "Sign out before using another account."
                    )
                }
            )

        data = TokenObtainSerializer.validate(self, attrs)

        session_id = uuid4()
        request.session.cycle_key()
        request.session["login_session_id"] = str(session_id)
        request.session["login_user_id"] = self.user.pk
        request.session.set_expiry(0)

        refresh = self.get_token(self.user)
        refresh["session_id"] = str(session_id)

        data["refresh"] = str(refresh)
        data["access"] = str(refresh.access_token)

        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, self.user)

        return data


class SingleSessionTokenRefreshSerializer(TokenRefreshSerializer):
    """Only refresh tokens belonging to this browser session may rotate."""

    def validate(self, attrs):
        refresh = self.token_class(attrs["refresh"])
        user_id = refresh.get(api_settings.USER_ID_CLAIM)
        session_id = refresh.get("session_id")

        request = self.context["request"]
        expire_closed_browser_session(request)
        browser_session_id = request.session.get("login_session_id")
        browser_user_id = request.session.get("login_user_id")
        user = get_user_model().objects.filter(
            **{api_settings.USER_ID_FIELD: user_id}
        ).only("is_active").first()

        if (
            user is None
            or not api_settings.USER_AUTHENTICATION_RULE(user)
            or not session_id
            or not browser_session_id
            or str(browser_session_id) != str(session_id)
            or str(browser_user_id) != str(user_id)
        ):
            raise AuthenticationFailed(
                SESSION_ERROR,
                code="session_not_active",
            )

        return super().validate(attrs)
