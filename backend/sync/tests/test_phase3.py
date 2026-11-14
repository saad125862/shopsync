import time
from unittest import mock

import jwt
import pytest
from rest_framework.test import APIClient

from sync import api, reconcile
from sync.models import Alert, InventoryLevel, Location, Product, Shop, Variant
from sync.tests.test_phase2 import FakeClient

SHOP = "demo-store.myshopify.com"
OTHER = "other-store.myshopify.com"


@pytest.fixture(autouse=True)
def creds(settings):
    settings.SHOPIFY_API_KEY = "key123"
    settings.SHOPIFY_API_SECRET = "secret123"
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"


def token(shop):
    now = int(time.time())
    return jwt.encode(
        {"dest": f"https://{shop}", "aud": "key123", "exp": now + 60, "nbf": now - 5},
        "secret123",
        algorithm="HS256",
    )


def client_for(shop=SHOP):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token(shop)}")
    return c


@pytest.fixture
def data(db):
    shop = Shop.objects.create(domain=SHOP, low_stock_threshold=5)
    other = Shop.objects.create(domain=OTHER)
    loc = Location.objects.create(shop=shop, shopify_id=1, name="Dhaka")
    p = Product.objects.create(shop=shop, shopify_id=1, title="Hoodie")
    levels = {}
    for i, (title, qty) in enumerate([("S", 0), ("M", 3), ("L", 40)]):
        v = Variant.objects.create(
            product=p, shopify_id=10 + i, title=title, sku=f"H-{title}", inventory_item_id=100 + i
        )
        levels[title] = InventoryLevel.objects.create(variant=v, location=loc, available=qty)
    return shop, other, loc, levels


def test_requires_auth(db):
    assert APIClient().get("/api/overview").status_code in (401, 403)


def test_overview(data):
    resp = client_for().get("/api/overview")
    assert resp.status_code == 200
    assert resp.json()["products"] == 1 and resp.json()["variants"] == 3


def test_inventory_filters(data):
    c = client_for()
    assert c.get("/api/inventory").json()["count"] == 3
    assert c.get("/api/inventory?status=out").json()["count"] == 1
    assert c.get("/api/inventory?status=low").json()["results"][0]["variant_title"] == "M"
    assert c.get("/api/inventory?status=ok").json()["count"] == 1
    assert c.get("/api/inventory?q=H-L").json()["count"] == 1


def test_tenant_isolation(data):
    other_client = client_for(OTHER)
    assert other_client.get("/api/inventory").json()["count"] == 0
    level = data[3]["S"]
    resp = other_client.post(f"/api/inventory/{level.id}/adjust", {"delta": 1}, format="json")
    assert resp.status_code == 404


def test_adjust_pushes_to_shopify_and_updates_local(data):
    level = data[3]["M"]
    with mock.patch.object(api, "adjust_in_shopify") as push:
        resp = client_for().post(f"/api/inventory/{level.id}/adjust", {"delta": 20}, format="json")
    assert resp.status_code == 200
    push.assert_called_once()
    level.refresh_from_db()
    assert level.available == 23
    assert not Alert.objects.filter(variant=level.variant, resolved_at__isnull=True).exists()


def test_adjust_shopify_error_returns_502(data):
    level = data[3]["M"]
    with mock.patch.object(api, "adjust_in_shopify", side_effect=api.ShopifyError("nope")):
        resp = client_for().post(f"/api/inventory/{level.id}/adjust", {"delta": 1}, format="json")
    assert resp.status_code == 502
    level.refresh_from_db()
    assert level.available == 3


def test_adjust_mutation_payload(data):
    shop, _, loc, levels = data
    client = mock.Mock()
    client.execute.return_value = {"inventoryAdjustQuantities": {"userErrors": []}}
    api.adjust_in_shopify(shop, levels["M"], -2, client)
    change = client.execute.call_args[0][1]["input"]["changes"][0]
    assert change["delta"] == -2
    assert change["inventoryItemId"] == "gid://shopify/InventoryItem/101"
    assert change["locationId"] == "gid://shopify/Location/1"


def test_settings_roundtrip(data):
    c = client_for()
    resp = c.patch("/api/settings", {"low_stock_threshold": 10, "alert_email": "a@b.co"}, format="json")
    assert resp.json()["low_stock_threshold"] == 10
    assert c.get("/api/inventory?status=low").json()["count"] == 1  # still only M (3 <= 10)


def test_alert_rule_override_and_cross_tenant_guard(data):
    shop, other, loc, levels = data
    c = client_for()
    ok = c.post(
        "/api/alert-rules", {"variant": levels["L"].variant_id, "threshold": 50}, format="json"
    )
    assert ok.status_code == 201
    from sync.alerts import evaluate_level

    assert evaluate_level(levels["L"]).level == "low"  # 40 <= 50 override
    foreign = Location.objects.create(shop=other, shopify_id=9, name="X")
    bad = c.post("/api/alert-rules", {"location": foreign.id, "threshold": 1}, format="json")
    assert bad.status_code == 400


def test_device_registration(data):
    resp = client_for().post("/api/devices", {"token": "ExponentPushToken[abc]"}, format="json")
    assert resp.status_code == 201
    assert data[0].device_tokens.count() == 1


def test_push_sent_on_new_alert(data):
    shop, _, loc, levels = data
    shop.device_tokens.create(token="ExponentPushToken[abc]")
    from sync.alerts import evaluate_level

    with mock.patch("sync.notify.requests.post") as post:
        evaluate_level(levels["S"])
    assert post.called and "out of stock" in post.call_args[1]["json"][0]["body"].lower()


def test_reconcile_repairs_drift(data):
    shop, _, loc, levels = data
    node = {
        "id": "gid://shopify/Product/1",
        "title": "Hoodie",
        "vendor": "",
        "status": "ACTIVE",
        "featuredMedia": None,
        "variants": {
            "edges": [
                {
                    "node": {
                        "id": "gid://shopify/ProductVariant/11",
                        "title": "M",
                        "sku": "H-M",
                        "price": "10",
                        "inventoryItem": {
                            "id": "gid://shopify/InventoryItem/101",
                            "inventoryLevels": {
                                "edges": [
                                    {
                                        "node": {
                                            "location": {"id": "gid://shopify/Location/1"},
                                            "quantities": [{"name": "available", "quantity": 99}],
                                        }
                                    }
                                ]
                            },
                        },
                    }
                }
            ]
        },
    }
    log = reconcile.reconcile(
        shop,
        FakeClient(
            {
                "locations": [
                    {"id": "gid://shopify/Location/1", "name": "Dhaka", "isActive": True}
                ],
                "products": [node],
            }
        ),
    )
    assert "corrected=1" in log.detail
    levels["M"].refresh_from_db()
    assert levels["M"].available == 99


def test_trigger_sync_queues_task(data):
    with mock.patch("sync.tasks.services.full_sync") as fs:
        resp = client_for().post("/api/sync")
    assert resp.status_code == 202 and fs.called
