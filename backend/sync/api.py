"""REST API for the dashboard and mobile app. All endpoints are scoped to the calling shop."""

from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, serializers, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .auth import SessionTokenAuthentication
from .models import (
    Alert,
    AlertRule,
    DeviceToken,
    InventoryLevel,
    Location,
    Order,
    SyncLog,
)
from .shopify import GraphQLClient, ShopifyError


class IsShop(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and getattr(request.user, "shop", None))


class Page(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class ShopView(APIView):
    authentication_classes = [SessionTokenAuthentication]
    permission_classes = [IsShop]

    @property
    def shop(self):
        return self.request.user.shop

    def paginated(self, qs, serializer_cls):
        paginator = Page()
        page = paginator.paginate_queryset(qs, self.request, view=self)
        return paginator.get_paginated_response(serializer_cls(page, many=True).data)


# ---- serializers -----------------------------------------------------------------------------


class LocationSer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ["id", "shopify_id", "name", "active"]


class InventorySer(serializers.ModelSerializer):
    product = serializers.CharField(source="variant.product.title")
    image_url = serializers.CharField(source="variant.product.image_url")
    variant_title = serializers.CharField(source="variant.title")
    sku = serializers.CharField(source="variant.sku")
    location_name = serializers.CharField(source="location.name")
    threshold = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = InventoryLevel
        fields = [
            "id",
            "product",
            "image_url",
            "variant_title",
            "sku",
            "location",
            "location_name",
            "available",
            "threshold",
            "status",
        ]

    def get_threshold(self, obj):
        from .alerts import threshold_for

        return threshold_for(obj)

    def get_status(self, obj):
        if obj.available <= 0:
            return "out"
        return "low" if obj.available <= self.get_threshold(obj) else "ok"


class OrderSer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "name",
            "total_price",
            "currency",
            "financial_status",
            "fulfillment_status",
            "created_at_shopify",
            "items",
        ]

    def get_items(self, obj):
        return [
            {"title": li.title, "sku": li.sku, "quantity": li.quantity} for li in obj.lines.all()
        ]


class AlertSer(serializers.ModelSerializer):
    product = serializers.CharField(source="variant.product.title")
    variant_title = serializers.CharField(source="variant.title")
    sku = serializers.CharField(source="variant.sku")
    location_name = serializers.CharField(source="location.name")

    class Meta:
        model = Alert
        fields = [
            "id",
            "product",
            "variant_title",
            "sku",
            "location_name",
            "level",
            "available",
            "threshold",
            "created_at",
            "resolved_at",
        ]


class SyncLogSer(serializers.ModelSerializer):
    class Meta:
        model = SyncLog
        fields = ["id", "kind", "status", "detail", "started_at", "finished_at"]


class AlertRuleSer(serializers.ModelSerializer):
    class Meta:
        model = AlertRule
        fields = ["id", "variant", "location", "threshold"]


class SettingsSer(serializers.Serializer):
    low_stock_threshold = serializers.IntegerField(min_value=0)
    alert_email = serializers.EmailField(allow_blank=True)


class AdjustSer(serializers.Serializer):
    delta = serializers.IntegerField()


class DeviceSer(serializers.Serializer):
    token = serializers.CharField(max_length=255)


# ---- views -----------------------------------------------------------------------------------


class OverviewView(ShopView):
    @extend_schema(responses=dict)
    def get(self, request):
        shop = self.shop
        since = timezone.now() - timedelta(days=30)
        orders = Order.objects.filter(shop=shop, created_at_shopify__gte=since)
        open_alerts = Alert.objects.filter(shop=shop, resolved_at__isnull=True)
        last = SyncLog.objects.filter(shop=shop, status="ok").first()
        daily = (
            orders.values("created_at_shopify__date")
            .annotate(orders=Count("id"), revenue=Sum("total_price"))
            .order_by("created_at_shopify__date")
        )
        return Response(
            {
                "products": shop.products.count(),
                "variants": InventoryLevel.objects.filter(location__shop=shop).count(),
                "low_stock": open_alerts.filter(level="low").count(),
                "out_of_stock": open_alerts.filter(level="out").count(),
                "orders_30d": orders.count(),
                "revenue_30d": orders.aggregate(t=Sum("total_price"))["t"] or 0,
                "last_sync": last.finished_at if last else None,
                "daily": [
                    {
                        "date": d["created_at_shopify__date"],
                        "orders": d["orders"],
                        "revenue": d["revenue"],
                    }
                    for d in daily
                ],
            }
        )


class InventoryListView(ShopView):
    @extend_schema(responses=InventorySer(many=True))
    def get(self, request):
        qs = InventoryLevel.objects.filter(location__shop=self.shop).select_related(
            "variant__product", "location"
        )
        p = request.query_params
        if p.get("location"):
            qs = qs.filter(location_id=p["location"])
        if p.get("q"):
            qs = qs.filter(
                Q(variant__sku__icontains=p["q"]) | Q(variant__product__title__icontains=p["q"])
            )
        threshold = self.shop.low_stock_threshold
        status_filter = p.get("status")
        if status_filter == "out":
            qs = qs.filter(available__lte=0)
        elif status_filter == "low":
            qs = qs.filter(available__gt=0, available__lte=threshold)
        elif status_filter == "ok":
            qs = qs.filter(available__gt=threshold)
        return self.paginated(qs.order_by("available", "id"), InventorySer)


class InventoryAdjustView(ShopView):
    """Two-way sync: push a stock change to Shopify, then mirror it locally."""

    @extend_schema(request=AdjustSer, responses=InventorySer)
    def post(self, request, pk):
        ser = AdjustSer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            level = InventoryLevel.objects.select_related("variant__product", "location").get(
                pk=pk, location__shop=self.shop
            )
        except InventoryLevel.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        delta = ser.validated_data["delta"]
        try:
            adjust_in_shopify(self.shop, level, delta)
        except ShopifyError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        level = services.set_level(level.variant, level.location, level.available + delta)
        return Response(InventorySer(level).data)


ADJUST_M = """
mutation($input: InventoryAdjustQuantitiesInput!) {
  inventoryAdjustQuantities(input: $input) { userErrors { field message } }
}"""


def adjust_in_shopify(shop, level, delta, client=None):
    client = client or GraphQLClient(shop.domain, shop.access_token)
    data = client.execute(
        ADJUST_M,
        {
            "input": {
                "reason": "correction",
                "name": "available",
                "changes": [
                    {
                        "delta": delta,
                        "inventoryItemId": f"gid://shopify/InventoryItem/{level.variant.inventory_item_id}",
                        "locationId": f"gid://shopify/Location/{level.location.shopify_id}",
                    }
                ],
            }
        },
    )
    errors = data["inventoryAdjustQuantities"]["userErrors"]
    if errors:
        raise ShopifyError("; ".join(e["message"] for e in errors))


class OrderListView(ShopView):
    @extend_schema(responses=OrderSer(many=True))
    def get(self, request):
        qs = Order.objects.filter(shop=self.shop).prefetch_related("lines")
        return self.paginated(qs, OrderSer)


class AlertListView(ShopView):
    @extend_schema(responses=AlertSer(many=True))
    def get(self, request):
        qs = Alert.objects.filter(shop=self.shop).select_related(
            "variant__product", "location"
        )
        if request.query_params.get("open", "1") == "1":
            qs = qs.filter(resolved_at__isnull=True)
        return self.paginated(qs, AlertSer)


class AlertRuleView(ShopView):
    @extend_schema(responses=AlertRuleSer(many=True))
    def get(self, request):
        return Response(AlertRuleSer(AlertRule.objects.filter(shop=self.shop), many=True).data)

    @extend_schema(request=AlertRuleSer, responses=AlertRuleSer)
    def post(self, request):
        ser = AlertRuleSer(data=request.data)
        ser.is_valid(raise_exception=True)
        for key in ("variant", "location"):
            obj = ser.validated_data.get(key)
            product = getattr(obj, "product", None)
            owner = getattr(obj, "shop", None) or getattr(product, "shop", None)
            if obj is not None and owner != self.shop:
                return Response({"detail": f"Bad {key}"}, status=status.HTTP_400_BAD_REQUEST)
        rule = ser.save(shop=self.shop)
        return Response(AlertRuleSer(rule).data, status=status.HTTP_201_CREATED)


class SyncLogView(ShopView):
    @extend_schema(responses=SyncLogSer(many=True))
    def get(self, request):
        return self.paginated(SyncLog.objects.filter(shop=self.shop), SyncLogSer)

    @extend_schema(request=None, responses={202: dict})
    def post(self, request):
        from .tasks import full_sync_task

        full_sync_task.delay(self.shop.id)
        return Response({"detail": "Sync queued"}, status=status.HTTP_202_ACCEPTED)


class LocationListView(ShopView):
    @extend_schema(responses=LocationSer(many=True))
    def get(self, request):
        return Response(LocationSer(self.shop.locations.all(), many=True).data)


class SettingsView(ShopView):
    @extend_schema(responses=SettingsSer)
    def get(self, request):
        s = self.shop
        return Response(
            {"low_stock_threshold": s.low_stock_threshold, "alert_email": s.alert_email}
        )

    @extend_schema(request=SettingsSer, responses=SettingsSer)
    def patch(self, request):
        ser = SettingsSer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        for key, value in ser.validated_data.items():
            setattr(self.shop, key, value)
        self.shop.save()
        return self.get(request)


class DeviceView(ShopView):
    @extend_schema(request=DeviceSer, responses={201: dict})
    def post(self, request):
        ser = DeviceSer(data=request.data)
        ser.is_valid(raise_exception=True)
        DeviceToken.objects.update_or_create(
            token=ser.validated_data["token"], defaults={"shop": self.shop}
        )
        return Response({"detail": "registered"}, status=status.HTTP_201_CREATED)
