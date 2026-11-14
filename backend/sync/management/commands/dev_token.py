"""Print a local session token so the dashboard/mobile app can call the API in development."""

import time

import jwt
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Print a dev JWT for a shop (signed with SHOPIFY_API_SECRET). Development only."

    def add_arguments(self, parser):
        parser.add_argument("--shop", default="demo-store.myshopify.com")
        parser.add_argument("--hours", type=int, default=24 * 7)

    def handle(self, *args, **opts):
        if not settings.DEBUG:
            raise CommandError("dev_token only works with DEBUG=True")
        if not settings.SHOPIFY_API_SECRET or not settings.SHOPIFY_API_KEY:
            raise CommandError("Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET in .env first")
        now = int(time.time())
        claims = {
            "iss": f"https://{opts['shop']}/admin",
            "dest": f"https://{opts['shop']}",
            "aud": settings.SHOPIFY_API_KEY,
            "iat": now,
            "nbf": now - 5,
            "exp": now + opts["hours"] * 3600,
        }
        self.stdout.write(jwt.encode(claims, settings.SHOPIFY_API_SECRET, algorithm="HS256"))
