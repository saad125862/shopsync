"""Upsert logic shared by the full sync (GraphQL) and webhooks (REST payloads)."""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .alerts import evaluate_level
from .models import (
    InventoryLevel,
    Location,
    Order,
    OrderLine,
    Product,
    Shop,
    SyncLog,
    Variant,
)
from .shopify import GraphQLClient, gid_to_int

SHOP_Q = "{ shop { currencyCode } }"

LOCATIONS_Q = """
query($cursor: String) {
  locations(first: 50, after: $cursor) {
    edges { node { id name isActive } }
    pageInfo { hasNextPage endCursor }
  }
}"""

PRODUCTS_Q = """
query($cursor: String) {
  products(first: 20, after: $cursor) {
    edges { node {
      id title vendor status
      featuredMedia { preview { image { url } } }
      variants(first: 100) { edges { node {
        id title sku price
        inventoryItem { id inventoryLevels(first: 20) { edges { node {
          location { id }
          quantities(names: ["available"]) { name quantity }
        } } } }
      } } }
    } }
    pageInfo { hasNextPage endCursor }
  }
}"""

ORDERS_Q = """
query($cursor: String) {
  orders(first: 50, after: $cursor, sortKey: CREATED_AT, reverse: true) {
    edges { node {
      id name createdAt displayFinancialStatus displayFulfillmentStatus
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      lineItems(first: 50) { edges { node {
        title sku quantity variant { id }
        originalUnitPriceSet { shopMoney { amount } }
      } } }
    } }
    pageInfo { hasNextPage endCursor }
  }
}"""


# ---- normalizers -----------------------------------------------------------------------------


def norm_product_graphql(node: dict) -> dict:
    image = (((node.get("featuredMedia") or {}).get("preview") or {}).get("image") or {}).get("url")
    variants = []
    for ve in node["variants"]["edges"]:
        v = ve["node"]
        item = v.get("inventoryItem") or {}
        levels = []
        for le in (item.get("inventoryLevels") or {}).get("edges", []):
            ln = le["node"]
            qty = next((q["quantity"] for q in ln["quantities"] if q["name"] == "available"), 0)
            levels.append({"location_id": gid_to_int(ln["location"]["id"]), "available": qty})
        variants.append(
            {
                "id": gid_to_int(v["id"]),
                "title": v.get("title") or "",
                "sku": v.get("sku") or "",
                "price": v.get("price") or 0,
                "inventory_item_id": gid_to_int(item.get("id")),
                "levels": levels,
            }
        )
    return {
        "id": gid_to_int(node["id"]),
        "title": node["title"],
        "vendor": node.get("vendor") or "",
        "status": (node.get("status") or "").lower(),
        "image": image or "",
        "variants": variants,
    }


def norm_product_rest(p: dict) -> dict:
    return {
        "id": p["id"],
        "title": p.get("title", ""),
        "vendor": p.get("vendor") or "",
        "status": p.get("status") or "",
        "image": ((p.get("image") or {}).get("src")) or "",
        "variants": [
            {
                "id": v["id"],
                "title": v.get("title") or "",
                "sku": v.get("sku") or "",
                "price": v.get("price") or 0,
                "inventory_item_id": v.get("inventory_item_id"),
                "levels": None,  # REST product payloads carry no per-location levels
            }
            for v in p.get("variants", [])
        ],
    }


# ---- upserts ---------------------------------------------------------------------------------


@transaction.atomic
def upsert_product(shop: Shop, data: dict) -> Product:
    product, _ = Product.objects.update_or_create(
        shop=shop,
        shopify_id=data["id"],
        defaults={
            "title": data["title"],
            "vendor": data["vendor"],
            "status": data["status"],
            "image_url": data["image"],
        },
    )
    seen = []
    for v in data["variants"]:
        variant, _ = Variant.objects.update_or_create(
            product=product,
            shopify_id=v["id"],
            defaults={
                "title": v["title"],
                "sku": v["sku"],
                "price": Decimal(str(v["price"])),
                "inventory_item_id": v["inventory_item_id"],
            },
        )
        seen.append(variant.id)
        for lv in v["levels"] or []:
            location = Location.objects.filter(shop=shop, shopify_id=lv["location_id"]).first()
            if location:
                set_level(variant, location, lv["available"])
    product.variants.exclude(id__in=seen).delete()
    return product


def set_level(variant: Variant, location: Location, available: int) -> InventoryLevel:
    level, _ = InventoryLevel.objects.update_or_create(
        variant=variant, location=location, defaults={"available": available}
    )
    evaluate_level(level)
    return level


def upsert_location(shop: Shop, shopify_id: int, name: str, active: bool = True) -> Location:
    loc, _ = Location.objects.update_or_create(
        shop=shop, shopify_id=shopify_id, defaults={"name": name, "active": active}
    )
    return loc


def upsert_order(shop: Shop, d: dict) -> Order:
    created = parse_datetime(d["created_at"]) if d.get("created_at") else None
    with transaction.atomic():
        order, _ = Order.objects.update_or_create(
            shop=shop,
            shopify_id=d["id"],
            defaults={
                "name": d["name"],
                "total_price": Decimal(str(d.get("total_price") or 0)),
                "currency": d.get("currency") or "",
                "financial_status": (d.get("financial_status") or "").lower(),
                "fulfillment_status": (d.get("fulfillment_status") or "").lower(),
                "created_at_shopify": created,
            },
        )
        order.lines.all().delete()
        OrderLine.objects.bulk_create(
            OrderLine(
                order=order,
                shopify_variant_id=li.get("variant_id"),
                sku=li.get("sku") or "",
                title=li.get("title") or "",
                quantity=li.get("quantity") or 1,
                price=Decimal(str(li.get("price") or 0)),
            )
            for li in d.get("line_items", [])
        )
    return order


def norm_order_graphql(node: dict) -> dict:
    money = (node.get("currentTotalPriceSet") or {}).get("shopMoney") or {}
    return {
        "id": gid_to_int(node["id"]),
        "name": node["name"],
        "total_price": money.get("amount", 0),
        "currency": money.get("currencyCode", ""),
        "financial_status": node.get("displayFinancialStatus") or "",
        "fulfillment_status": node.get("displayFulfillmentStatus") or "",
        "created_at": node.get("createdAt"),
        "line_items": [
            {
                "variant_id": gid_to_int((li["node"].get("variant") or {}).get("id")),
                "sku": li["node"].get("sku"),
                "title": li["node"].get("title"),
                "quantity": li["node"].get("quantity"),
                "price": (
                    ((li["node"].get("originalUnitPriceSet") or {}).get("shopMoney") or {}).get(
                        "amount"
                    )
                ),
            }
            for li in node["lineItems"]["edges"]
        ],
    }


def refresh_shop_currency(shop: Shop, client: GraphQLClient) -> str:
    """Store the shop's currency (e.g. BDT) so the dashboard shows prices in the right currency."""
    data = client.execute(SHOP_Q)
    code = ((data or {}).get("shop") or {}).get("currencyCode")
    if code and code != shop.currency:
        shop.currency = code
        shop.save(update_fields=["currency"])
    return shop.currency


# ---- full sync -------------------------------------------------------------------------------


def full_sync(shop: Shop, client: GraphQLClient | None = None) -> SyncLog:
    log = SyncLog.objects.create(shop=shop, kind="full_sync")
    client = client or GraphQLClient(shop.domain, shop.access_token)
    try:
        refresh_shop_currency(shop, client)
        n_loc = n_prod = n_ord = 0
        for node in client.paginate(LOCATIONS_Q, ["locations"]):
            upsert_location(shop, gid_to_int(node["id"]), node["name"], node["isActive"])
            n_loc += 1
        for node in client.paginate(PRODUCTS_Q, ["products"]):
            upsert_product(shop, norm_product_graphql(node))
            n_prod += 1
        for node in client.paginate(ORDERS_Q, ["orders"]):
            upsert_order(shop, norm_order_graphql(node))
            n_ord += 1
        log.status = SyncLog.Status.OK
        log.detail = f"locations={n_loc} products={n_prod} orders={n_ord}"
    except Exception as exc:
        log.status = SyncLog.Status.FAILED
        log.detail = str(exc)[:2000]
        log.finished_at = timezone.now()
        log.save()
        raise
    log.finished_at = timezone.now()
    log.save()
    return log


# ---- webhook registration --------------------------------------------------------------------

WEBHOOK_TOPICS = [
    "PRODUCTS_CREATE",
    "PRODUCTS_UPDATE",
    "PRODUCTS_DELETE",
    "INVENTORY_LEVELS_UPDATE",
    "ORDERS_CREATE",
    "ORDERS_UPDATED",
    "APP_UNINSTALLED",
]

WEBHOOK_M = """
mutation($topic: WebhookSubscriptionTopic!, $url: URL!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: {callbackUrl: $url, format: JSON}) {
    userErrors { field message }
  }
}"""


def register_webhooks(shop: Shop, callback_url: str, client: GraphQLClient | None = None) -> list:
    client = client or GraphQLClient(shop.domain, shop.access_token)
    problems = []
    for topic in WEBHOOK_TOPICS:
        data = client.execute(WEBHOOK_M, {"topic": topic, "url": callback_url})
        for err in data["webhookSubscriptionCreate"]["userErrors"]:
            if "already been taken" not in err["message"]:
                problems.append((topic, err["message"]))
    return problems
