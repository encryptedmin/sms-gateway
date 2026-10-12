from rest_framework.decorators import api_view
from rest_framework.decorators import authentication_classes
from rest_framework.decorators import permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from users.permissions import IsSuperAdmin
from users.permissions import IsIteAdmin
from users.models import User
from .serializers import CurrentUserSerializer
from .serializers import DepartmentAdminCreateSerializer
from .serializers import InstructorAccountSerializer
from .serializers import DepartmentAdminAccountSerializer
from .serializers import InstructorCreateSerializer
from .serializers import ChangePasswordSerializer
from .serializers import ResetPasswordSerializer
from .session_state import expire_closed_browser_session
from .session_state import mark_browser_closing
from .session_state import resume_browser_session
from .session_state import invalidate_user_sessions


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def logout(request):
    """End only this browser's session, leaving other devices signed in."""

    request.session.flush()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
def device_session(request):
    """Report whether this browser already owns an active login."""

    expire_closed_browser_session(request)

    session_id = request.session.get("login_session_id")
    user_id = request.session.get("login_user_id")
    is_active = bool(
        session_id
        and user_id
        and User.objects.filter(pk=user_id, is_active=True).exists()
    )

    if session_id and user_id and not is_active:
        request.session.flush()

    return Response(
        {
            "active": is_active,
            "user_id": user_id if is_active else None,
        }
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def device_session_closing(request):
    """Receive the last-tab pagehide beacon from the browser."""

    mark_browser_closing(request)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def device_session_resume(request):
    """Cancel a close marker when the same browser promptly reloads."""

    expire_closed_browser_session(request)

    if request.session.get("login_session_id"):
        resume_browser_session(request)

    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):

    return Response(
        CurrentUserSerializer(request.user).data
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Allow department admins and instructors to change their password."""

    if request.user.role not in ["DEPARTMENT_ADMIN", "INSTRUCTOR"]:
        return Response(
            {"detail": "Password changes are not available for this role."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = ChangePasswordSerializer(
        data=request.data,
        context={"user": request.user},
    )
    serializer.is_valid(raise_exception=True)

    request.user.set_password(serializer.validated_data["new_password"])
    request.user.save(update_fields=["password"])
    invalidate_user_sessions(request.user.pk)

    return Response(
        {"detail": "Password changed. Sign in again with the new password."}
    )


@api_view(["GET", "POST"])
@permission_classes([IsSuperAdmin])
def department_admin_accounts(request):

    if request.method == "POST":
        serializer = DepartmentAdminCreateSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        user = serializer.save()

        return Response(
            DepartmentAdminAccountSerializer(user).data,
            status=status.HTTP_201_CREATED
        )

    admins = User.objects.filter(
        role="DEPARTMENT_ADMIN",
        is_ite_admin=True
    ).order_by(
        "last_name",
        "first_name",
    )

    return Response(
        DepartmentAdminAccountSerializer(
            admins,
            many=True
        ).data
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsSuperAdmin])
def department_admin_account_detail(request, pk):

    admin = get_object_or_404(
        User,
        pk=pk,
        role="DEPARTMENT_ADMIN",
        is_ite_admin=True
    )

    if request.method == "DELETE":
        admin.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )

    serializer = DepartmentAdminAccountSerializer(
        admin,
        data=request.data,
        partial=True
    )

    serializer.is_valid(
        raise_exception=True
    )

    serializer.save()

    return Response(
        serializer.data
    )


@api_view(["POST"])
@permission_classes([IsSuperAdmin])
def reset_department_admin_password(request, pk):
    admin = get_object_or_404(
        User,
        pk=pk,
        role="DEPARTMENT_ADMIN",
        is_ite_admin=True,
    )
    serializer = ResetPasswordSerializer(
        data=request.data,
        context={"user": admin},
    )
    serializer.is_valid(raise_exception=True)

    admin.set_password(serializer.validated_data["new_password"])
    admin.save(update_fields=["password"])
    invalidate_user_sessions(admin.pk)

    return Response(
        {"detail": "Department admin password reset successfully."}
    )


@api_view(["POST"])
@permission_classes([IsIteAdmin])
def create_instructor(request):

    serializer = InstructorCreateSerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    user = serializer.save()

    return Response(
        InstructorCreateSerializer(user).data,
        status=status.HTTP_201_CREATED
    )


@api_view(["GET", "POST"])
@permission_classes([IsIteAdmin])
def instructor_accounts(request):

    if request.method == "POST":
        serializer = InstructorCreateSerializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        user = serializer.save()

        return Response(
            InstructorAccountSerializer(user).data,
            status=status.HTTP_201_CREATED
        )

    instructors = User.objects.filter(
        role="INSTRUCTOR",
        is_ite_instructor=True
    ).order_by(
        "last_name",
        "first_name",
    )

    return Response(
        InstructorAccountSerializer(
            instructors,
            many=True
        ).data
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsIteAdmin])
def instructor_account_detail(request, pk):

    instructor = get_object_or_404(
        User,
        pk=pk,
        role="INSTRUCTOR",
        is_ite_instructor=True
    )

    if request.method == "DELETE":
        instructor.delete()

        return Response(
            status=status.HTTP_204_NO_CONTENT
        )

    serializer = InstructorAccountSerializer(
        instructor,
        data=request.data,
        partial=True
    )

    serializer.is_valid(
        raise_exception=True
    )

    serializer.save()

    return Response(
        serializer.data
    )


@api_view(["POST"])
@permission_classes([IsIteAdmin])
def reset_instructor_password(request, pk):
    instructor = get_object_or_404(
        User,
        pk=pk,
        role="INSTRUCTOR",
        is_ite_instructor=True,
    )
    serializer = ResetPasswordSerializer(
        data=request.data,
        context={"user": instructor},
    )
    serializer.is_valid(raise_exception=True)

    instructor.set_password(serializer.validated_data["new_password"])
    instructor.save(update_fields=["password"])
    invalidate_user_sessions(instructor.pk)

    return Response(
        {"detail": "Instructor password reset successfully."}
    )
