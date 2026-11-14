import hashlib
import hmac
import time
from unittest import mock

import jwt
import pytest
from django.conf import settings
from rest_framework.test import APIClient

from sync import shopify
from sync.models import Shop

SHOP = "demo-store.myshopify.com"


@pytest.fixture(autouse=True)
def creds(settings):
    settings.SHOPIFY_API_KEY = "key123"
    settings.SHOPIFY_API_SECRET = "secret123"
    settings.APP_URL = "https://app.example.com"
    settings.CELERY_TASK_ALWAYS_EAGER = True


def sign(params: dict) -> dict:
    msg = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    params["hmac"] = hmac.new(b"secret123", msg.encode(), hashlib.sha256).hexdigest()
    return params


def test_valid_shop():
    assert shopify.valid_shop(SHOP)
    assert not shopify.valid_shop("evil.com")
    assert not shopify.valid_shop("a.myshopify.com.evil.com")


def test_query_hmac_roundtrip():
    params = sign({"shop": SHOP, "timestamp": "1"})
    assert shopify.verify_query_hmac(params)
    params["shop"] = "other.myshopify.com"
    assert not shopify.verify_query_hmac(params)


@pytest.mark.django_db
def test_token_is_encrypted_at_rest():
    shop = Shop(domain=SHOP)
    shop.access_token = "shpat_secret"
    shop.save()
    shop.refresh_from_db()
    assert "shpat_secret" not in shop.access_token_enc
    assert shop.access_token == "shpat_secret"


@pytest.mark.django_db
def test_install_redirects_to_shopify(client):
    resp = client.get("/auth/install", sign({"shop": SHOP}))
    assert resp.status_code == 302
    assert resp["Location"].startswith(f"https://{SHOP}/admin/oauth/authorize?")


@pytest.mark.django_db
def test_install_rejects_bad_shop(client):
    assert client.get("/auth/install", {"shop": "evil.com"}).status_code == 400


@pytest.mark.django_db
def test_callback_creates_shop(client):
    client.get("/auth/install", sign({"shop": SHOP}))
    state = client.session["shopify_oauth_state"]
    params = sign({"shop": SHOP, "code": "abc", "state": state})
    with mock.patch(
        "sync.shopify.exchange_code", return_value={"access_token": "tok", "scope": "read_products"}
    ):
        resp = client.get("/auth/callback", params)
    assert resp.status_code == 302
    shop = Shop.objects.get(domain=SHOP)
    assert shop.access_token == "tok"


@pytest.mark.django_db
def test_callback_rejects_bad_state(client):
    client.get("/auth/install", sign({"shop": SHOP}))
    params = sign({"shop": SHOP, "code": "abc", "state": "wrong"})
    assert client.get("/auth/callback", params).status_code == 400


def make_token(shop=SHOP, **over):
    now = int(time.time())
    claims = {
        "iss": f"https://{shop}/admin",
        "dest": f"https://{shop}",
        "aud": settings.SHOPIFY_API_KEY,
        "exp": now + 60,
        "nbf": now - 5,
    }
    claims.update(over)
    return jwt.encode(claims, settings.SHOPIFY_API_SECRET, algorithm="HS256")


@pytest.mark.django_db
def test_session_token_auth():
    from sync.auth import SessionTokenAuthentication

    Shop.objects.create(domain=SHOP)
    from rest_framework.test import APIRequestFactory

    req = APIRequestFactory().get("/x", HTTP_AUTHORIZATION=f"Bearer {make_token()}")
    user, claims = SessionTokenAuthentication().authenticate(req)
    assert user.shop.domain == SHOP

    bad = APIRequestFactory().get("/x", HTTP_AUTHORIZATION=f"Bearer {make_token(aud='nope')}")
    from rest_framework import exceptions

    with pytest.raises(exceptions.AuthenticationFailed):
        SessionTokenAuthentication().authenticate(bad)

    assert APIClient() is not None
