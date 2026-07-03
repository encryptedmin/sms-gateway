from rest_framework.decorators import api_view
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
from .serializers import InstructorCreateSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):

    return Response(
        CurrentUserSerializer(request.user).data
    )


@api_view(["POST"])
@permission_classes([IsSuperAdmin])
def create_department_admin(request):

    serializer = DepartmentAdminCreateSerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    user = serializer.save()

    return Response(
        DepartmentAdminCreateSerializer(user).data,
        status=status.HTTP_201_CREATED
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
