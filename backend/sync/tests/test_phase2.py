import base64
import hashlib
import hmac
import json
from unittest import mock

import pytest

from sync import services
from sync.models import (
    Alert,
    InventoryLevel,
    Location,
    Order,
    Product,
    Shop,
    Variant,
    WebhookEvent,
)

SHOP = "demo-store.myshopify.com"


@pytest.fixture(autouse=True)
def creds(settings):
    settings.SHOPIFY_API_KEY = "key123"
    settings.SHOPIFY_API_SECRET = "secret123"
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"


@pytest.fixture
def shop(db):
    s = Shop(domain=SHOP, alert_email="owner@example.com")
    s.access_token = "tok"
    s.save()
    return s


def post_webhook(client, topic, payload, webhook_id="wh-1", secret=b"secret123"):
    body = json.dumps(payload).encode()
    sig = base64.b64encode(hmac.new(secret, body, hashlib.sha256).digest()).decode()
    return client.post(
        "/webhooks/shopify",
        data=body,
        content_type="application/json",
        HTTP_X_SHOPIFY_HMAC_SHA256=sig,
        HTTP_X_SHOPIFY_TOPIC=topic,
        HTTP_X_SHOPIFY_SHOP_DOMAIN=SHOP,
        HTTP_X_SHOPIFY_WEBHOOK_ID=webhook_id,
    )


PRODUCT = {
    "id": 1,
    "title": "Hoodie",
    "vendor": "Acme",
    "status": "active",
    "image": {"src": "https://img/x.png"},
    "variants": [
        {"id": 11, "title": "M / Black", "sku": "HD-M-BLK", "price": "49.00", "inventory_item_id": 111}
    ],
}


def test_webhook_rejects_bad_hmac(client, shop):
    resp = post_webhook(client, "products/create", PRODUCT, secret=b"wrong")
    assert resp.status_code == 403
    assert WebhookEvent.objects.count() == 0


def test_product_webhook_creates_product(client, shop):
    assert post_webhook(client, "products/create", PRODUCT).status_code == 200
    p = Product.objects.get(shopify_id=1)
    assert p.title == "Hoodie" and p.variants.count() == 1
    assert WebhookEvent.objects.get().status == "processed"


def test_webhook_is_idempotent(client, shop):
    post_webhook(client, "products/create", PRODUCT, webhook_id="same")
    renamed = {**PRODUCT, "title": "Renamed"}
    post_webhook(client, "products/update", renamed, webhook_id="same")
    assert WebhookEvent.objects.count() == 1
    assert Product.objects.get(shopify_id=1).title == "Hoodie"  # duplicate delivery ignored


def test_inventory_webhook_updates_level_and_alerts(client, shop, mailoutbox):
    Location.objects.create(shop=shop, shopify_id=500, name="Dhaka")
    post_webhook(client, "products/create", PRODUCT, webhook_id="a")
    inv = {"inventory_item_id": 111, "location_id": 500, "available": 3}
    post_webhook(client, "inventory_levels/update", inv, webhook_id="b")
    assert InventoryLevel.objects.get().available == 3
    alert = Alert.objects.get()
    assert alert.level == "low" and len(mailoutbox) == 1

    post_webhook(client, "inventory_levels/update", {**inv, "available": 0}, webhook_id="c")
    assert Alert.objects.filter(resolved_at__isnull=True).get().level == "out"

    post_webhook(client, "inventory_levels/update", {**inv, "available": 50}, webhook_id="d")
    assert not Alert.objects.filter(resolved_at__isnull=True).exists()


def test_order_webhook(client, shop):
    order = {
        "id": 9,
        "name": "#1001",
        "total_price": "98.00",
        "currency": "USD",
        "financial_status": "paid",
        "created_at": "2026-01-01T10:00:00Z",
        "line_items": [{"variant_id": 11, "sku": "HD-M-BLK", "title": "Hoodie", "quantity": 2}],
    }
    post_webhook(client, "orders/create", order)
    o = Order.objects.get(shopify_id=9)
    assert o.lines.get().quantity == 2


def test_uninstall_webhook(client, shop):
    post_webhook(client, "app/uninstalled", {})
    shop.refresh_from_db()
    assert not shop.is_active and shop.access_token == ""


def test_failed_event_is_recorded(client, shop):
    with mock.patch.dict("sync.webhooks.HANDLERS", {"orders/create": lambda s, p: 1 / 0}):
        resp = post_webhook(client, "orders/create", {"id": 1}, webhook_id="f")
    assert resp.status_code == 200  # always ack; failure is stored for replay
    event = WebhookEvent.objects.get(webhook_id="f")
    assert event.status == "failed" and "division" in event.error


class FakeClient:
    def __init__(self, data):
        self.data = data

    def paginate(self, query, path, variables=None):
        return iter(self.data[path[0]])

    def execute(self, query, variables=None):
        return {"webhookSubscriptionCreate": {"userErrors": []}}


def test_full_sync(shop):
    data = {
        "locations": [{"id": "gid://shopify/Location/500", "name": "Dhaka", "isActive": True}],
        "products": [
            {
                "id": "gid://shopify/Product/1",
                "title": "Hoodie",
                "vendor": "Acme",
                "status": "ACTIVE",
                "featuredMedia": None,
                "variants": {
                    "edges": [
                        {
                            "node": {
                                "id": "gid://shopify/ProductVariant/11",
                                "title": "M",
                                "sku": "HD-M",
                                "price": "49.00",
                                "inventoryItem": {
                                    "id": "gid://shopify/InventoryItem/111",
                                    "inventoryLevels": {
                                        "edges": [
                                            {
                                                "node": {
                                                    "location": {"id": "gid://shopify/Location/500"},
                                                    "quantities": [{"name": "available", "quantity": 2}],
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
        ],
        "orders": [
            {
                "id": "gid://shopify/Order/9",
                "name": "#1001",
                "createdAt": "2026-01-01T10:00:00Z",
                "displayFinancialStatus": "PAID",
                "displayFulfillmentStatus": "UNFULFILLED",
                "currentTotalPriceSet": {"shopMoney": {"amount": "49.00", "currencyCode": "USD"}},
                "lineItems": {
                    "edges": [
                        {
                            "node": {
                                "title": "Hoodie",
                                "sku": "HD-M",
                                "quantity": 1,
                                "variant": {"id": "gid://shopify/ProductVariant/11"},
                            }
                        }
                    ]
                },
            }
        ],
    }
    log = services.full_sync(shop, FakeClient(data))
    assert log.status == "ok" and "products=1" in log.detail
    assert Variant.objects.get().inventory_item_id == 111
    assert InventoryLevel.objects.get().available == 2
    assert Alert.objects.filter(level="low").count() == 1
    assert Order.objects.count() == 1


def test_register_webhooks_ignores_already_taken(shop):
    class C(FakeClient):
        def execute(self, q, v=None):
            return {
                "webhookSubscriptionCreate": {
                    "userErrors": [{"field": [], "message": "Address for this topic has already been taken"}]
                }
            }

    assert services.register_webhooks(shop, "https://x/webhooks/shopify", C({})) == []


def test_gdpr_shop_redact(client, shop):
    body = b"{}"
    sig = base64.b64encode(hmac.new(b"secret123", body, hashlib.sha256).digest()).decode()
    resp = client.post(
        "/webhooks/gdpr",
        data=body,
        content_type="application/json",
        HTTP_X_SHOPIFY_HMAC_SHA256=sig,
        HTTP_X_SHOPIFY_TOPIC="shop/redact",
        HTTP_X_SHOPIFY_SHOP_DOMAIN=SHOP,
    )
    assert resp.status_code == 200
    assert not Shop.objects.filter(domain=SHOP).exists()



def test_sync_stores_the_shop_currency(shop):
    class C(FakeClient):
        def execute(self, q, v=None):
            return {"shop": {"currencyCode": "BDT"}}

    services.refresh_shop_currency(shop, C({}))
    shop.refresh_from_db()
    assert shop.currency == "BDT"
    # a client without shop data (older fakes) leaves it unchanged
    services.refresh_shop_currency(shop, FakeClient({}))
    shop.refresh_from_db()
    assert shop.currency == "BDT"
