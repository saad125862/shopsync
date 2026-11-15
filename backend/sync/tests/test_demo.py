import time

import jwt
import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from sync.models import Shop


class _Null:
    def write(self, *_a, **_k):
        pass

    def flush(self):
        pass


@pytest.fixture(autouse=True)
def creds(settings):
    settings.SHOPIFY_API_KEY = "k"
    settings.SHOPIFY_API_SECRET = "s" * 32
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.DEMO_ENABLED = True


@pytest.fixture
def demo(db, settings):
    call_command("seed_demo", shop=settings.DEMO_SHOP_DOMAIN, orders=3, stdout=_Null())
    resp = APIClient().post("/api/demo-login")
    assert resp.status_code == 200
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.json()['token']}")
    return client


def test_demo_login_unavailable_until_seeded(db):
    assert APIClient().post("/api/demo-login").status_code == 404


def test_demo_login_disabled_by_flag(db, settings):
    Shop.objects.create(domain=settings.DEMO_SHOP_DOMAIN)
    settings.DEMO_ENABLED = False
    assert APIClient().post("/api/demo-login").status_code == 404


def test_demo_can_read_everything(demo):
    assert demo.get("/api/overview").json()["products"] == 20
    assert demo.get("/api/products").json()["count"] == 20
    assert demo.get("/api/orders").json()["count"] == 3
    assert demo.get("/api/inventory").status_code == 200
    assert demo.get("/api/search?q=hoodie").status_code == 200


def test_demo_cannot_change_anything(demo):
    level = demo.get("/api/inventory").json()["results"][0]["id"]
    for method, url, body in [
        ("post", f"/api/inventory/{level}/adjust", {"delta": 1}),
        ("patch", "/api/settings", {"low_stock_threshold": 1}),
        ("post", "/api/sync", None),
        ("post", "/api/mobile-token", None),
        ("post", "/api/devices", {"token": "x"}),
        ("post", "/api/alert-rules", {"threshold": 1}),
    ]:
        resp = getattr(demo, method)(url, body, format="json")
        assert resp.status_code == 403, url
        assert "read-only" in resp.json()["detail"].lower()


def test_demo_token_cannot_reach_a_real_store(db, settings):
    """A demo-typed token only works for the demo domain, never for a real shop."""
    Shop.objects.create(domain="real-store.myshopify.com")
    now = int(time.time())
    token = jwt.encode(
        {
            "dest": "https://real-store.myshopify.com",
            "aud": "k",
            "typ": "demo",
            "exp": now + 60,
            "nbf": now - 5,
        },
        "s" * 32,
        algorithm="HS256",
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    # valid shop domain, so it authenticates as that shop but is still read-only: no writes possible
    assert client.post("/api/sync").status_code == 403


def test_demo_domain_cannot_be_used_with_a_normal_token(db, settings):
    Shop.objects.create(domain=settings.DEMO_SHOP_DOMAIN)
    now = int(time.time())
    token = jwt.encode(
        {"dest": f"https://{settings.DEMO_SHOP_DOMAIN}", "aud": "k", "exp": now + 60, "nbf": now - 5},
        "s" * 32,
        algorithm="HS256",
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    assert client.get("/api/overview").status_code == 401  # not typ=demo and not a myshopify domain


def test_reconcile_skips_shops_without_a_token(db, settings, monkeypatch):
    """The seeded fake demo store has no Shopify token, so the nightly reconcile must skip it."""
    from sync import tasks

    Shop.objects.create(domain=settings.DEMO_SHOP_DOMAIN)
    called = []
    monkeypatch.setattr("sync.reconcile.reconcile", lambda shop: called.append(shop.domain))
    assert tasks.reconcile_all() == 0 and called == []

    real = Shop(domain="real-store.myshopify.com")
    real.access_token = "tok"
    real.save()
    assert tasks.reconcile_all() == 1 and called == ["real-store.myshopify.com"]


def test_demo_can_point_at_a_real_store_read_only(db, settings):
    """DEMO_SHOP_DOMAIN may be set to a real dev store: visitors then see it, read-only."""
    real = Shop(domain="shopsync-demo-abc.myshopify.com")
    real.access_token = "tok"
    real.save()
    settings.DEMO_SHOP_DOMAIN = real.domain
    resp = APIClient().post("/api/demo-login")
    assert resp.status_code == 200 and resp.json()["shop"] == real.domain
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.json()['token']}")
    assert client.get("/api/overview").status_code == 200
    assert client.post("/api/sync").status_code == 403
