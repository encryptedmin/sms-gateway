from django.conf import settings
from django.utils import timezone
from django.contrib.sessions.models import Session


BROWSER_CLOSING_AT_KEY = "browser_closing_at"


def mark_browser_closing(request):
    """Mark the last browser tab as closing without breaking page reloads."""

    if request.session.get("login_session_id"):
        request.session[BROWSER_CLOSING_AT_KEY] = timezone.now().timestamp()
        request.session.modified = True


def resume_browser_session(request):
    """Cancel a recent close marker after a page reload or tab restore."""

    if BROWSER_CLOSING_AT_KEY in request.session:
        request.session.pop(BROWSER_CLOSING_AT_KEY, None)
        request.session.modified = True


def expire_closed_browser_session(request):
    """
    Flush a session whose last tab reported closing and did not return
    during the short page-reload grace period.
    """

    closing_at = request.session.get(BROWSER_CLOSING_AT_KEY)
    if closing_at is None:
        return False

    elapsed = timezone.now().timestamp() - float(closing_at)

    if elapsed < settings.BROWSER_SESSION_CLOSE_GRACE_SECONDS:
        return False

    request.session.flush()
    return True


def invalidate_user_sessions(user_id):
    """Delete every active browser session belonging to one user."""

    matching_session_keys = []

    for session in Session.objects.filter(
        expire_date__gte=timezone.now()
    ).iterator():
        try:
            session_user_id = session.get_decoded().get("login_user_id")
        except Exception:
            continue

        if str(session_user_id) == str(user_id):
            matching_session_keys.append(session.session_key)

    if matching_session_keys:
        Session.objects.filter(
            session_key__in=matching_session_keys
        ).delete()
