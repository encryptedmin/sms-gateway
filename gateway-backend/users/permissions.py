from rest_framework.permissions import BasePermission
from rest_framework.permissions import SAFE_METHODS

class IsSuperAdmin(BasePermission):

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == "SUPER_ADMIN"
        )


class IsIteAdmin(BasePermission):

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            (
                request.user.is_ite_admin or
                request.user.role == "DEPARTMENT_ADMIN"
            )
        )


class IsIteInstructor(BasePermission):

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            (
                request.user.is_ite_instructor or
                request.user.role == "INSTRUCTOR"
            )
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
    
class CanManageContactGroup(BasePermission):

    def has_permission(self, request, view):
        return CanSendSms().has_permission(request, view)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if request.user.role == "INSTRUCTOR":
            return obj.owner_id == request.user.id
        if request.user.role == "DEPARTMENT_ADMIN":
            return obj.owner_id in [
                request.user.id,
                None,
            ]
        return True


class CanManageContact(BasePermission):

    def has_permission(self, request, view):
        return CanSendSms().has_permission(request, view)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True

        if request.user.role == "SUPER_ADMIN":
            return True

        if obj.owner_id == request.user.id:
            return True

        return (
            request.user.role == "DEPARTMENT_ADMIN" and
            obj.owner_id is None
        )
        
