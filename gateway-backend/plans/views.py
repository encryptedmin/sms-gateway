from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from users.permissions import IsAdminRole

from .models import Plan
from .serializers import PlanSerializer


class PlanViewSet(ModelViewSet):

    queryset = Plan.objects.all().order_by("price", "plan_name")
    serializer_class = PlanSerializer

    def get_permissions(self):

        if self.action in [
            "list",
            "retrieve",
        ]:
            return [
                IsAuthenticated()
            ]

        return [
            IsAdminRole()
        ]
