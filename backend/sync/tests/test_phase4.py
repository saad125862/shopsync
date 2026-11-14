import time

import jwt
import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from sync import demo_data
from sync.management.commands.seed_shopify import product_set_input
from sync.models import Alert, InventoryLevel, Order, Product, Shop, Variant

SHOP = "demo-store.myshopify.com"


def test_catalog_is_deterministic_and_has_variants():
    a = list(demo_data.iter_variants())
    b = list(demo_data.iter_variants())
    assert a == b
    n_variants = sum(len(p["variants"]) for p in a)
    assert 15 <= len(a) <= 25 and 50 <= n_variants <= 200
    skus = [v["sku"] for p in a for v in p["variants"]]
    assert len(skus) == len(set(skus)), "SKUs must be unique"


@pytest.mark.django_db
def test_seed_demo_populates_and_is_idempotent():
    call_command("seed_demo", orders=10, stdout=_Null())
    first = (Product.objects.count(), Variant.objects.count(), Order.objects.count())
    call_command("seed_demo", orders=10, stdout=_Null())
    assert first == (Product.objects.count(), Variant.objects.count(), Order.objects.count())
    assert first[0] == len(demo_data.CATALOG)
    assert InventoryLevel.objects.count() == first[1] * len(demo_data.LOCATIONS)
    statuses = set(Alert.objects.values_list("level", flat=True))
    assert statuses == {"low", "out"}


@pytest.mark.django_db
def test_seeded_data_served_by_api(settings):
    settings.SHOPIFY_API_KEY = "k"
    settings.SHOPIFY_API_SECRET = "s" * 32
    call_command("seed_demo", orders=5, stdout=_Null())
    now = int(time.time())
    tok = jwt.encode(
        {"dest": f"https://{SHOP}", "aud": "k", "exp": now + 60, "nbf": now - 5},
        "s" * 32,
        algorithm="HS256",
    )
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")
    ov = c.get("/api/overview").json()
    assert ov["products"] == len(demo_data.CATALOG) and ov["orders_30d"] == 5
    assert ov["low_stock"] > 0 and ov["out_of_stock"] > 0


def test_product_set_input_shape():
    product = next(demo_data.iter_variants())
    inp = product_set_input(product, {"Dhaka Warehouse": "gid://shopify/Location/1"})
    assert inp["title"] == product["title"]
    assert len(inp["variants"]) == len(product["variants"])
    first = inp["variants"][0]
    assert {o["optionName"] for o in first["optionValues"]} == {"Size", "Color"}
    assert first["inventoryQuantities"][0]["locationId"] == "gid://shopify/Location/1"


@pytest.mark.django_db
def test_dev_token_requires_secret(settings):
    from django.core.management.base import CommandError

    settings.SHOPIFY_API_SECRET = ""
    with pytest.raises(CommandError):
        call_command("dev_token")
    settings.SHOPIFY_API_KEY = "k"
    settings.SHOPIFY_API_SECRET = "s" * 32
    settings.DEBUG = True
    out = _Null()
    call_command("dev_token", stdout=out)
    assert Shop.objects.count() == 0  # token generation does not create shops


class _Null:
    def write(self, *_a, **_k):
        pass

    def flush(self):
        pass
