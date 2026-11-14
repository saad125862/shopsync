"""Shopify helpers: HMAC checks, OAuth URLs/token exchange, Admin GraphQL client."""

import base64
import hashlib
import hmac
import re
import time
from urllib.parse import urlencode

import requests
from django.conf import settings

API_VERSION = "2025-10"
SHOP_RE = re.compile(r"^[a-z0-9][a-z0-9\-]*\.myshopify\.com$")


def valid_shop(domain: str) -> bool:
    return bool(domain and SHOP_RE.match(domain))


def verify_query_hmac(params: dict) -> bool:
    """Verify the `hmac` query param on OAuth install/callback requests."""
    params = dict(params)
    given = params.pop("hmac", "")
    message = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    digest = hmac.new(
        settings.SHOPIFY_API_SECRET.encode(), message.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(digest, given)


def verify_webhook_hmac(body: bytes, header: str) -> bool:
    digest = hmac.new(settings.SHOPIFY_API_SECRET.encode(), body, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode()
    return hmac.compare_digest(expected, header or "")


def authorize_url(shop: str, state: str) -> str:
    qs = urlencode(
        {
            "client_id": settings.SHOPIFY_API_KEY,
            "scope": settings.SHOPIFY_SCOPES,
            "redirect_uri": f"{settings.APP_URL}/auth/callback",
            "state": state,
        }
    )
    return f"https://{shop}/admin/oauth/authorize?{qs}"


def exchange_code(shop: str, code: str) -> dict:
    resp = requests.post(
        f"https://{shop}/admin/oauth/access_token",
        json={
            "client_id": settings.SHOPIFY_API_KEY,
            "client_secret": settings.SHOPIFY_API_SECRET,
            "code": code,
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


class ShopifyError(Exception):
    pass


class GraphQLClient:
    """Minimal Admin GraphQL client with throttle-aware retries."""

    def __init__(self, shop: str, token: str, max_retries: int = 4):
        self.url = f"https://{shop}/admin/api/{API_VERSION}/graphql.json"
        self.token = token
        self.max_retries = max_retries

    def execute(self, query: str, variables: dict | None = None) -> dict:
        for attempt in range(self.max_retries + 1):
            resp = requests.post(
                self.url,
                json={"query": query, "variables": variables or {}},
                headers={"X-Shopify-Access-Token": self.token},
                timeout=30,
            )
            if resp.status_code == 429 or resp.status_code >= 500:
                time.sleep(min(2**attempt, 8))
                continue
            resp.raise_for_status()
            body = resp.json()
            errors = body.get("errors")
            if errors:
                if any(e.get("extensions", {}).get("code") == "THROTTLED" for e in errors):
                    time.sleep(min(2**attempt, 8))
                    continue
                raise ShopifyError(str(errors))
            return body["data"]
        raise ShopifyError("Shopify request failed after retries")

    def paginate(self, query: str, path: list[str], variables: dict | None = None):
        """Yield nodes from a connection at `path`; the query must use $cursor and pageInfo."""
        variables = dict(variables or {})
        cursor = None
        while True:
            variables["cursor"] = cursor
            data = self.execute(query, variables)
            conn = data
            for key in path:
                conn = conn[key]
            for edge in conn["edges"]:
                yield edge["node"]
            if not conn["pageInfo"]["hasNextPage"]:
                return
            cursor = conn["pageInfo"]["endCursor"]


def gid_to_int(gid: str | int | None) -> int | None:
    if gid is None:
        return None
    if isinstance(gid, int):
        return gid
    return int(str(gid).rsplit("/", 1)[-1])
