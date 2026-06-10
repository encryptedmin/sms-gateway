from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from users.permissions import IsSuperAdmin
from .serializers import CurrentUserSerializer
from .serializers import DepartmentAdminCreateSerializer


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
