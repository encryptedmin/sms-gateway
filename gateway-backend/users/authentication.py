from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from .session_state import expire_closed_browser_session


class SingleSessionJWTAuthentication(JWTAuthentication):
    """Require a JWT to belong to this browser's Django session cookie."""

    def authenticate(self, request):
        expire_closed_browser_session(request)
        authenticated = super().authenticate(request)

        if authenticated is None:
            return None

        user, validated_token = authenticated
        token_session_id = validated_token.get("session_id")
        browser_session_id = request.session.get("login_session_id")
        browser_user_id = request.session.get("login_user_id")

        if (
            not token_session_id
            or not browser_session_id
            or str(browser_session_id) != str(token_session_id)
            or str(browser_user_id) != str(user.pk)
        ):
            raise AuthenticationFailed(
                "This login does not belong to the active browser session.",
                code="session_not_active",
            )

        return user, validated_token
