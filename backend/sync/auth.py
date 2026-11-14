"""Verify Shopify App Bridge session tokens (JWT, HS256 signed with the app secret)."""

import jwt
from django.conf import settings
from rest_framework import authentication, exceptions

from .models import Shop
from .shopify import valid_shop


class ShopUser:
    """Lightweight authenticated principal representing a shop."""

    is_authenticated = True

    def __init__(self, shop: Shop):
        self.shop = shop


def decode_session_token(token: str) -> dict:
    try:
        return jwt.decode(
            token,
            settings.SHOPIFY_API_SECRET,
            algorithms=["HS256"],
            audience=settings.SHOPIFY_API_KEY,
            leeway=10,
        )
    except jwt.PyJWTError as exc:
        raise exceptions.AuthenticationFailed(f"Invalid session token: {exc}") from exc


class SessionTokenAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode()
        if not header.startswith(self.keyword + " "):
            return None
        claims = decode_session_token(header[len(self.keyword) + 1 :])
        dest = claims.get("dest", "").removeprefix("https://")
        if not valid_shop(dest):
            raise exceptions.AuthenticationFailed("Bad shop in token")
        try:
            shop = Shop.objects.get(domain=dest, is_active=True)
        except Shop.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("Shop not installed") from exc
        return (ShopUser(shop), claims)

    def authenticate_header(self, request):
        return self.keyword
