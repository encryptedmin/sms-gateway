from django.contrib import admin
from django.urls import path
from django.urls import include
from subscribers.views import register_subscriber
from users.views import current_user
from users.views import department_admin_accounts
from users.views import department_admin_account_detail
from users.views import instructor_accounts
from users.views import instructor_account_detail
from users.views import logout
from users.views import device_session
from users.views import device_session_closing
from users.views import device_session_resume
from users.views import change_password
from users.views import reset_department_admin_password
from users.views import reset_instructor_password
from users.token_serializers import SingleSessionTokenObtainPairSerializer
from users.token_serializers import SingleSessionTokenRefreshSerializer

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


class SingleSessionTokenObtainPairView(TokenObtainPairView):
    serializer_class = SingleSessionTokenObtainPairSerializer


class SingleSessionTokenRefreshView(TokenRefreshView):
    serializer_class = SingleSessionTokenRefreshSerializer

urlpatterns = [

    path(
        "admin/",
        admin.site.urls
    ),

    path(
        "api/",
        include(
            "gateway.urls"
        )
    ),

    path(
        "api/token/",
        SingleSessionTokenObtainPairView.as_view(),
        name="token_obtain_pair"
    ),

    path(
        "api/token/refresh/",
        SingleSessionTokenRefreshView.as_view(),
        name="token_refresh"
    ),

    path(
        "api/logout/",
        logout,
        name="logout"
    ),

    path(
        "api/device-session/",
        device_session,
        name="device_session"
    ),
    path(
        "api/device-session/closing/",
        device_session_closing,
        name="device_session_closing"
    ),
    path(
        "api/device-session/resume/",
        device_session_resume,
        name="device_session_resume"
    ),

    path(
        "api/me/",
        current_user,
        name="current_user"
    ),
    path(
        "api/change-password/",
        change_password,
        name="change_password"
    ),

    path(
        "api/admin-accounts/",
        department_admin_accounts,
        name="department_admin_accounts"
    ),

    path(
        "api/admin-accounts/<int:pk>/",
        department_admin_account_detail,
        name="department_admin_account_detail"
    ),
    path(
        "api/admin-accounts/<int:pk>/reset-password/",
        reset_department_admin_password,
        name="reset_department_admin_password"
    ),

    path(
        "api/instructors/",
        instructor_accounts,
        name="instructor_accounts"
    ),

    path(
        "api/instructors/<int:pk>/",
        instructor_account_detail,
        name="instructor_account_detail"
    ),
    path(
        "api/instructors/<int:pk>/reset-password/",
        reset_instructor_password,
        name="reset_instructor_password"
    ),

    path(
        "api/register/subscriber/",
        register_subscriber,
        name="register_subscriber"
    ),

]
