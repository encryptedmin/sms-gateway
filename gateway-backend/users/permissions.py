from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == "SUPER_ADMIN"
        )


class IsDepartmentAdmin(BasePermission):

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == "DEPARTMENT_ADMIN"
        )


class IsInstructor(BasePermission):

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == "INSTRUCTOR"
        )


class IsSubscriber(BasePermission):

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == "SUBSCRIBER"
        )


class IsAdminRole(BasePermission):

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in [
                "SUPER_ADMIN",
                "DEPARTMENT_ADMIN",
            ]
        )


class CanSendSms(BasePermission):

    def has_permission(self, request, view):

        allowed_roles = [
            "SUPER_ADMIN",
            "DEPARTMENT_ADMIN",
            "INSTRUCTOR",
        ]

        return (
            request.user.is_authenticated and
            request.user.role in allowed_roles
        )
