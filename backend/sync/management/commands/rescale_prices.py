"""Rescale the demo catalog's prices in Shopify (e.g. USD-scale 18 -> BDT-scale 2150).

    python manage.py rescale_prices --shop x.myshopify.com               # dry run, prints a preview
    python manage.py rescale_prices --shop x.myshopify.com --apply       # writes to Shopify

Safety: products whose highest variant price is already >= --skip-above are left alone, so running
this twice does not multiply prices again. Shopify then sends products/update webhooks, which update
ShopSync automatically. Needs the write_products scope.
"""

from django.core.management.base import BaseCommand, CommandError

from sync import services
from sync.models import Shop
from sync.shopify import GraphQLClient

BULK_UPDATE_M = """
mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    userErrors { field message }
  }
}"""


def new_price(old: float, factor: float = 120, step: int = 50) -> int:
    """Scale a price and round to a friendly step (e.g. nearest 50)."""
    return max(step, int(round(old * factor / step)) * step)


class Command(BaseCommand):
    help = "Rescale product prices in Shopify (dry run unless --apply)."

    def add_arguments(self, parser):
        parser.add_argument("--shop", required=True)
        parser.add_argument("--factor", type=float, default=120)
        parser.add_argument("--step", type=int, default=50)
        parser.add_argument("--skip-above", type=float, default=400)
        parser.add_argument("--apply", action="store_true")

    def handle(self, *args, **opts):
        shop = Shop.objects.filter(domain=opts["shop"], is_active=True).first()
        if not shop or not shop.access_token:
            raise CommandError("Install the app on this store first (no access token).")
        client = GraphQLClient(shop.domain, shop.access_token)
        changed = skipped = 0
        for node in client.paginate(services.PRODUCTS_Q, ["products"]):
            variants = [e["node"] for e in node["variants"]["edges"]]
            prices = [float(v["price"] or 0) for v in variants]
            if not prices or max(prices) >= opts["skip_above"]:
                skipped += 1
                continue
            update = [
                {"id": v["id"], "price": str(new_price(p, opts["factor"], opts["step"]))}
                for v, p in zip(variants, prices, strict=True)
            ]
            self.stdout.write(
                f"{node['title']}: {', '.join(f'{p:g}' for p in prices[:3])}... -> "
                f"{', '.join(u['price'] for u in update[:3])}..."
            )
            if opts["apply"]:
                res = client.execute(
                    BULK_UPDATE_M, {"productId": node["id"], "variants": update}
                )["productVariantsBulkUpdate"]
                if res["userErrors"]:
                    self.stderr.write(f"  failed: {res['userErrors']}")
                    continue
            changed += 1
        mode = "Updated" if opts["apply"] else "Would update (dry run, add --apply)"
        self.stdout.write(self.style.SUCCESS(f"{mode}: {changed} products, skipped {skipped}"))
