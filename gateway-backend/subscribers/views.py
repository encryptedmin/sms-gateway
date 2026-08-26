from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from users.permissions import IsAdminRole

from .models import Subscriber
from .serializers import SubscriberRegisterSerializer
from .serializers import SubscriberSerializer


@api_view(["POST"])
@permission_classes([IsAdminRole])
def register_subscriber(request):
    """
    Enrolls a new subscriber (external department). LAN-only deployment
    with no public sign-up — enrollment is admin-initiated, so this is
    locked to IsAdminRole rather than open (was previously AllowAny).
    """

    serializer = SubscriberRegisterSerializer(
        data=request.data
    )

    serializer.is_valid(
        raise_exception=True
    )

    subscriber = serializer.save()

    return Response(
        SubscriberSerializer(subscriber).data,
        status=status.HTTP_201_CREATED
    )


class SubscriberViewSet(ModelViewSet):

    queryset = Subscriber.objects.select_related("user").all().order_by(
        "user__username"
    )
    serializer_class = SubscriberSerializer
    permission_classes = [
        IsAdminRole
    ]

    http_method_names = [
        "get",
        "patch",
        "delete",
        "head",
        "options",
    ]