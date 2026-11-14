"""Shopify-admin style read APIs: home overview, products, orders, global search."""

from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, IntegerField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_field
from rest_framework import serializers
from rest_framework.response import Response

from .alerts import threshold_for
from .api import ShopView
from .models import (
    DeviceToken,
    InventoryLevel,
    Order,
    OrderLine,
    Product,
    SyncLog,
    Variant,
    WebhookEvent,
)


def pct_change(cur, prev):
    cur, prev = Decimal(str(cur or 0)), Decimal(str(prev or 0))
    if prev == 0:
        return None
    return round(float((cur - prev) / prev * 100), 1)


class OverviewView(ShopView):
    """Home: sales summary for the last N days vs the previous N days, top products, setup guide."""

    @extend_schema(responses=dict)
    def get(self, request):
        shop = self.shop
        try:
            days = min(max(int(request.query_params.get("days", 30)), 1), 365)
        except ValueError:
            days = 30
        now = timezone.now()
        since = now - timedelta(days=days)
        prev_since = since - timedelta(days=days)
        cur = Order.objects.filter(shop=shop, created_at_shopify__gte=since)
        prev = Order.objects.filter(
            shop=shop, created_at_shopify__gte=prev_since, created_at_shopify__lt=since
        )

        def totals(qs):
            n = qs.count()
            revenue = qs.aggregate(t=Sum("total_price"))["t"] or Decimal(0)
            units = OrderLine.objects.filter(order__in=qs).aggregate(u=Sum("quantity"))["u"] or 0
            return {
                "orders": n,
                "revenue": revenue,
                "units": units,
                "aov": (revenue / n) if n else Decimal(0),
            }

        c, p = totals(cur), totals(prev)
        change = {k: pct_change(c[k], p[k]) for k in c}

        by_day = {
            d["created_at_shopify__date"]: d
            for d in cur.values("created_at_shopify__date").annotate(
                orders=Count("id"), revenue=Sum("total_price")
            )
        }
        daily = []
        for i in range(days):
            day = (since + timedelta(days=i + 1)).date()
            row = by_day.get(day)
            daily.append(
                {
                    "date": day,
                    "orders": row["orders"] if row else 0,
                    "revenue": row["revenue"] if row else 0,
                }
            )

        open_alerts = shop.alerts.filter(resolved_at__isnull=True)
        last_sync = SyncLog.objects.filter(shop=shop, status="ok").first()
        setup = [
            {"id": "installed", "title": "Install ShopSync on your store", "done": True},
            {
                "id": "sync",
                "title": "Run your first sync",
                "done": last_sync is not None or shop.products.exists(),
                "link": "/sync",
            },
            {
                "id": "webhooks",
                "title": "Receive live updates from Shopify",
                "done": WebhookEvent.objects.filter(shop=shop).exists(),
                "link": "/sync",
            },
            {
                "id": "email",
                "title": "Add an email for low-stock alerts",
                "done": bool(shop.alert_email),
                "link": "/settings",
            },
            {
                "id": "mobile",
                "title": "Connect the mobile app",
                "done": DeviceToken.objects.filter(shop=shop).exists(),
                "link": "/settings",
            },
        ]
        return Response(
            {
                "days": days,
                "shop": shop.domain,
                "products": shop.products.count(),
                "variants": InventoryLevel.objects.filter(location__shop=shop).count(),
                "low_stock": open_alerts.filter(level="low").count(),
                "out_of_stock": open_alerts.filter(level="out").count(),
                "orders": c["orders"],
                "revenue": c["revenue"],
                "units": c["units"],
                "aov": c["aov"],
                "change": change,
                # kept for older clients
                "orders_30d": c["orders"],
                "revenue_30d": c["revenue"],
                "last_sync": last_sync.finished_at if last_sync else None,
                "daily": daily,
                "top_products": top_products(shop, cur),
                "setup": setup,
            }
        )


def top_products(shop, orders_qs, limit=5):
    rows = (
        OrderLine.objects.filter(order__in=orders_qs)
        .values("shopify_variant_id", "title")
        .annotate(
            units=Sum("quantity"),
            revenue=Sum(
                ExpressionWrapper(
                    F("quantity") * F("price"),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                )
            ),
        )
    )
    wanted = [r["shopify_variant_id"] for r in rows if r["shopify_variant_id"]]
    variants = {
        v.shopify_id: v
        for v in Variant.objects.filter(product__shop=shop, shopify_id__in=wanted).select_related(
            "product"
        )
    }
    grouped: dict = {}
    for r in rows:
        v = variants.get(r["shopify_variant_id"])
        key = ("p", v.product_id) if v else ("t", r["title"])
        g = grouped.setdefault(
            key,
            {
                "id": v.product_id if v else None,
                "title": v.product.title if v else r["title"],
                "image_url": v.product.image_url if v else "",
                "units": 0,
                "revenue": Decimal(0),
            },
        )
        g["units"] += r["units"] or 0
        g["revenue"] += r["revenue"] or Decimal(0)
    return sorted(grouped.values(), key=lambda g: (-g["units"], g["title"]))[:limit]


# ---- products --------------------------------------------------------------------------------


class ProductRowSer(serializers.ModelSerializer):
    variants_count = serializers.IntegerField()
    total_available = serializers.IntegerField()
    out_levels = serializers.IntegerField()
    low_levels = serializers.IntegerField()
    stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "title",
            "vendor",
            "status",
            "image_url",
            "variants_count",
            "total_available",
            "out_levels",
            "low_levels",
            "stock",
        ]

    @extend_schema_field(serializers.ChoiceField(choices=["ok", "low", "out"]))
    def get_stock(self, obj):
        """Product-level state, like Shopify: judged on total stock, not on a single variant."""
        if obj.total_available <= 0:
            return "out"
        if obj.total_available <= obj.threshold * obj.variants_count:
            return "low"
        return "ok"


class ProductListView(ShopView):
    @extend_schema(responses=ProductRowSer(many=True))
    def get(self, request):
        shop = self.shop
        p = request.query_params
        qs = Product.objects.filter(shop=shop).annotate(
            threshold=Value(shop.low_stock_threshold, output_field=IntegerField()),
            variants_count=Count("variants", distinct=True),
            total_available=Coalesce(Sum("variants__levels__available"), 0),
            out_levels=Count("variants__levels", filter=Q(variants__levels__available__lte=0)),
            low_levels=Count(
                "variants__levels",
                filter=Q(
                    variants__levels__available__gt=0,
                    variants__levels__available__lte=shop.low_stock_threshold,
                ),
            ),
        )
        if p.get("q"):
            match = Q(title__icontains=p["q"]) | Q(variants__sku__icontains=p["q"])
            qs = qs.filter(id__in=Product.objects.filter(shop=shop).filter(match).values("id"))
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("vendor"):
            qs = qs.filter(vendor=p["vendor"])
        stock = p.get("stock")
        if stock == "out":
            qs = qs.filter(total_available__lte=0)
        elif stock == "low":  # low or out: needs attention
            qs = qs.filter(total_available__lte=F("threshold") * F("variants_count"))
        elif stock == "ok":
            qs = qs.filter(total_available__gt=F("threshold") * F("variants_count"))
        sorts = {
            "title": "title",
            "-title": "-title",
            "stock": "total_available",
            "-stock": "-total_available",
        }
        qs = qs.order_by(sorts.get(p.get("sort", "title"), "title"), "id")
        out = self.paginated(qs, ProductRowSer)
        out.data["vendors"] = list(
            Product.objects.filter(shop=shop)
            .exclude(vendor="")
            .order_by("vendor")
            .values_list("vendor", flat=True)
            .distinct()
        )
        return out


class ProductDetailView(ShopView):
    @extend_schema(responses=dict)
    def get(self, request, pk):
        try:
            product = Product.objects.get(pk=pk, shop=self.shop)
        except Product.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        variants = []
        total = 0
        for v in product.variants.all().order_by("id"):
            levels = []
            for lv in v.levels.select_related("location").order_by("location__name"):
                th = threshold_for(lv)
                state = "out" if lv.available <= 0 else "low" if lv.available <= th else "ok"
                total += lv.available
                levels.append(
                    {
                        "id": lv.id,
                        "location_name": lv.location.name,
                        "available": lv.available,
                        "threshold": th,
                        "status": state,
                    }
                )
            variants.append(
                {
                    "id": v.id,
                    "title": v.title,
                    "sku": v.sku,
                    "price": v.price,
                    "levels": levels,
                    "available": sum(lv["available"] for lv in levels),
                }
            )
        variant_ids = list(product.variants.values_list("shopify_id", flat=True))
        sold = (
            OrderLine.objects.filter(
                order__shop=self.shop, shopify_variant_id__in=variant_ids
            ).aggregate(u=Sum("quantity"))["u"]
            or 0
        )
        return Response(
            {
                "id": product.id,
                "title": product.title,
                "vendor": product.vendor,
                "status": product.status,
                "image_url": product.image_url,
                "total_available": total,
                "units_sold": sold,
                "variants": variants,
            }
        )


# ---- orders ----------------------------------------------------------------------------------


class OrderRowSer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

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
            "item_count",
            "items",
        ]

    def get_items(self, obj):
        return [
            {
                "title": li.title,
                "sku": li.sku,
                "quantity": li.quantity,
                "price": li.price,
            }
            for li in obj.lines.all()
        ]

    def get_item_count(self, obj):
        return sum(li.quantity for li in obj.lines.all())


class OrderListView(ShopView):
    @extend_schema(responses=OrderRowSer(many=True))
    def get(self, request):
        qs = Order.objects.filter(shop=self.shop).prefetch_related("lines")
        p = request.query_params
        status = p.get("status")
        if status == "unfulfilled":
            qs = qs.exclude(fulfillment_status="fulfilled")
        elif status == "fulfilled":
            qs = qs.filter(fulfillment_status="fulfilled")
        elif status in ("paid", "pending", "refunded"):
            qs = qs.filter(financial_status=status)
        if p.get("q"):
            qs = qs.filter(name__icontains=p["q"].lstrip("#"))
        return self.paginated(qs, OrderRowSer)


class OrderDetailView(ShopView):
    @extend_schema(responses=OrderRowSer)
    def get(self, request, pk):
        try:
            order = Order.objects.prefetch_related("lines").get(pk=pk, shop=self.shop)
        except Order.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        data = OrderRowSer(order).data
        data["subtotal"] = sum((li.price * li.quantity for li in order.lines.all()), Decimal(0))
        return Response(data)


# ---- search ----------------------------------------------------------------------------------


class SearchView(ShopView):
    @extend_schema(responses=dict)
    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response({"products": [], "orders": []})
        shop = self.shop
        products = (
            Product.objects.filter(shop=shop)
            .filter(Q(title__icontains=q) | Q(variants__sku__icontains=q))
            .distinct()[:6]
        )
        orders = Order.objects.filter(shop=shop, name__icontains=q.lstrip("#"))[:5]
        return Response(
            {
                "products": [
                    {"id": x.id, "title": x.title, "image_url": x.image_url, "vendor": x.vendor}
                    for x in products
                ],
                "orders": [
                    {
                        "id": o.id,
                        "name": o.name,
                        "total_price": o.total_price,
                        "currency": o.currency,
                    }
                    for o in orders
                ],
            }
        )
