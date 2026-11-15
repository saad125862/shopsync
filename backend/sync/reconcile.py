"""Nightly reconciliation: compare Shopify inventory with our copy and repair drift."""

from django.utils import timezone

from . import services
from .models import InventoryLevel, Shop, SyncLog
from .shopify import GraphQLClient, gid_to_int


def reconcile(shop: Shop, client: GraphQLClient | None = None) -> SyncLog:
    log = SyncLog.objects.create(shop=shop, kind="reconcile")
    client = client or GraphQLClient(shop.domain, shop.access_token)
    drift = checked = 0
    try:
        services.refresh_shop_currency(shop, client)
        for node in client.paginate(services.LOCATIONS_Q, ["locations"]):
            services.upsert_location(shop, gid_to_int(node["id"]), node["name"], node["isActive"])
        for node in client.paginate(services.PRODUCTS_Q, ["products"]):
            data = services.norm_product_graphql(node)
            for v in data["variants"]:
                for lv in v["levels"]:
                    checked += 1
                    local = InventoryLevel.objects.filter(
                        variant__product__shop=shop,
                        variant__shopify_id=v["id"],
                        location__shopify_id=lv["location_id"],
                    ).first()
                    if local is None or local.available != lv["available"]:
                        drift += 1
            services.upsert_product(shop, data)
        log.status = SyncLog.Status.OK
        log.detail = f"checked={checked} corrected={drift}"
    except Exception as exc:
        log.status = SyncLog.Status.FAILED
        log.detail = str(exc)[:2000]
        log.finished_at = timezone.now()
        log.save()
        raise
    log.finished_at = timezone.now()
    log.save()
    return log
