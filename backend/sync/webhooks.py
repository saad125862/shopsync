"""Webhook receiver (HMAC + idempotency) and per-topic handlers."""

import json
import logging

from django.http import HttpResponse, HttpResponseForbidden
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from . import services
from .models import Location, Product, Shop, Variant, WebhookEvent
from .shopify import verify_webhook_hmac

log = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def receive(request):
    body = request.body
    if not verify_webhook_hmac(body, request.headers.get("X-Shopify-Hmac-Sha256", "")):
        return HttpResponseForbidden("bad hmac")

    domain = request.headers.get("X-Shopify-Shop-Domain", "")
    topic = request.headers.get("X-Shopify-Topic", "")
    webhook_id = request.headers.get("X-Shopify-Webhook-Id", "")
    shop = Shop.objects.filter(domain=domain).first()
    if not shop or not webhook_id:
        return HttpResponse(status=200)  # nothing to do; don't make Shopify retry

    try:
        payload = json.loads(body or b"{}")
    except ValueError:
        return HttpResponse(status=400)

    event, created = WebhookEvent.objects.get_or_create(
        webhook_id=webhook_id, defaults={"shop": shop, "topic": topic, "payload": payload}
    )
    if created:
        from .tasks import process_webhook_event

        process_webhook_event.delay(event.id)
    return HttpResponse(status=200)


@csrf_exempt
@require_POST
def gdpr(request):
    """Mandatory compliance webhooks: customers/data_request, customers/redact, shop/redact."""
    if not verify_webhook_hmac(request.body, request.headers.get("X-Shopify-Hmac-Sha256", "")):
        return HttpResponseForbidden("bad hmac")
    topic = request.headers.get("X-Shopify-Topic", "")
    if topic == "shop/redact":
        domain = request.headers.get("X-Shopify-Shop-Domain", "")
        Shop.objects.filter(domain=domain).delete()
    # We store no customer personal data, so the customer topics need no action.
    return HttpResponse(status=200)


# ---- handlers --------------------------------------------------------------------------------


def handle_product_upsert(shop: Shop, p: dict):
    services.upsert_product(shop, services.norm_product_rest(p))


def handle_product_delete(shop: Shop, p: dict):
    Product.objects.filter(shop=shop, shopify_id=p["id"]).delete()


def handle_inventory_update(shop: Shop, p: dict):
    variant = Variant.objects.filter(
        product__shop=shop, inventory_item_id=p["inventory_item_id"]
    ).first()
    location = Location.objects.filter(shop=shop, shopify_id=p["location_id"]).first()
    if not variant or not location:
        return  # product/location not synced yet; the nightly reconcile will catch up
    available = p.get("available")
    if available is None:
        available = 0
    services.set_level(variant, location, int(available))


def handle_order(shop: Shop, p: dict):
    services.upsert_order(shop, p)


def handle_uninstalled(shop: Shop, p: dict):
    shop.is_active = False
    shop.access_token_enc = ""
    shop.uninstalled_at = timezone.now()
    shop.save()


HANDLERS = {
    "products/create": handle_product_upsert,
    "products/update": handle_product_upsert,
    "products/delete": handle_product_delete,
    "inventory_levels/update": handle_inventory_update,
    "orders/create": handle_order,
    "orders/updated": handle_order,
    "app/uninstalled": handle_uninstalled,
}


def dispatch(event: WebhookEvent):
    handler = HANDLERS.get(event.topic)
    if handler:
        handler(event.shop, event.payload)
