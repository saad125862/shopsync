import time
from datetime import timedelta

import jwt
import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from sync import services
from sync.models import Shop

SHOP = "demo-store.myshopify.com"


class _Null:
    def write(self, *_a, **_k):
        pass

    def flush(self):
        pass


@pytest.fixture
def api(db, settings):
    settings.SHOPIFY_API_KEY = "k"
    settings.SHOPIFY_API_SECRET = "s" * 32
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    call_command("seed_demo", orders=40, stdout=_Null())
    now = int(time.time())
    tok = jwt.encode(
        {"dest": f"https://{SHOP}", "aud": "k", "exp": now + 60, "nbf": now - 5},
        "s" * 32,
        algorithm="HS256",
    )
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")
    return c


def test_overview_has_sales_summary_and_setup(api):
    d = api.get("/api/overview?days=30").json()
    assert d["orders"] == 40 and float(d["revenue"]) > 0 and d["units"] >= 40
    assert float(d["aov"]) == pytest.approx(float(d["revenue"]) / 40, rel=1e-3)
    assert len(d["daily"]) == 30
    assert sum(x["orders"] for x in d["daily"]) == 40
    assert set(d["change"]) == {"orders", "revenue", "units", "aov"}
    assert d["change"]["orders"] is None  # seeded orders only fall in the current period
    assert [s["id"] for s in d["setup"]][0] == "installed"
    assert d["orders_30d"] == d["orders"]  # backwards compatible key


def test_overview_range_and_bad_param(api):
    assert len(api.get("/api/overview?days=7").json()["daily"]) == 7
    assert api.get("/api/overview?days=abc").json()["days"] == 30
    assert api.get("/api/overview?days=9999").json()["days"] == 365


def test_top_products_use_line_prices(api):
    top = api.get("/api/overview").json()["top_products"]
    assert 1 <= len(top) <= 5
    assert top == sorted(top, key=lambda t: (-t["units"], t["title"]))
    assert float(top[0]["revenue"]) > 0 and top[0]["id"] is not None


def test_products_list_filters_and_vendors(api):
    d = api.get("/api/products").json()
    assert d["count"] == 20 and "Dhaka Threads" in d["vendors"]
    row = d["results"][0]
    assert {"title", "variants_count", "total_available", "stock", "status"} <= set(row)
    assert api.get("/api/products?q=hoodie").json()["count"] == 2
    assert api.get("/api/products?vendor=Capital Caps").json()["count"] == 3
    low = api.get("/api/products?stock=low").json()
    ok = api.get("/api/products?stock=ok").json()
    assert low["count"] + ok["count"] == 20
    assert api.get("/api/products?sort=stock").json()["results"][0]["total_available"] <= (
        api.get("/api/products?sort=-stock").json()["results"][0]["total_available"]
    )


def test_product_detail_and_isolation(api):
    pid = api.get("/api/products?q=Classic Tee").json()["results"][0]["id"]
    d = api.get(f"/api/products/{pid}").json()
    assert d["title"] == "Classic Tee" and len(d["variants"]) == 12
    assert d["total_available"] == sum(v["available"] for v in d["variants"])
    assert d["variants"][0]["levels"][0]["status"] in ("ok", "low", "out")
    other = Shop.objects.create(domain="other.myshopify.com")
    assert other.products.count() == 0
    assert api.get("/api/products/999999").status_code == 404


def test_orders_filters_and_detail(api):
    d = api.get("/api/orders").json()
    assert d["count"] == 40 and d["results"][0]["item_count"] >= 1
    unf = api.get("/api/orders?status=unfulfilled").json()["count"]
    ful = api.get("/api/orders?status=fulfilled").json()["count"]
    assert unf + ful == 40
    assert api.get("/api/orders?status=paid").json()["count"] == 40
    assert api.get("/api/orders?q=%231001").json()["count"] == 1
    oid = d["results"][0]["id"]
    detail = api.get(f"/api/orders/{oid}").json()
    assert float(detail["subtotal"]) > 0 and detail["items"][0]["price"]
    assert api.get("/api/orders/999999").status_code == 404


def test_search(api):
    assert api.get("/api/search?q=h").json() == {"products": [], "orders": []}  # too short
    d = api.get("/api/search?q=hoodie").json()
    assert {p["title"] for p in d["products"]} == {"Premium Hoodie", "Zip Hoodie"}
    assert api.get("/api/search?q=%231002").json()["orders"][0]["name"] == "#1002"
    assert api.get("/api/search?q=CT-BLA").json()["products"][0]["title"] == "Classic Tee"


def test_line_price_persisted_from_webhook(db):
    shop = Shop.objects.create(domain=SHOP)
    order = services.upsert_order(
        shop,
        {
            "id": 1,
            "name": "#1",
            "total_price": "30.00",
            "created_at": (timezone.now() - timedelta(days=1)).isoformat(),
            "line_items": [{"variant_id": 9, "title": "X", "quantity": 3, "price": "10.00"}],
        },
    )
    assert order.lines.get().price == 10
