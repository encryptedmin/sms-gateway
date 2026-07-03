from django.contrib import admin
from django.urls import path
from django.urls import include
from subscribers.views import register_subscriber
from users.views import current_user
from users.views import create_department_admin
from users.views import instructor_accounts
from users.views import instructor_account_detail

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

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
        TokenObtainPairView.as_view(),
        name="token_obtain_pair"
    ),

    path(
        "api/token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh"
    ),

    path(
        "api/me/",
        current_user,
        name="current_user"
    ),

    path(
        "api/admin-accounts/",
        create_department_admin,
        name="create_department_admin"
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
        "api/register/subscriber/",
        register_subscriber,
        name="register_subscriber"
    ),

]
