"""Fill a shop with SAMPLE order history built from its real synced products (demo use only).

Sample orders use a reserved id range (>= SAMPLE_ID_BASE) and names like "#D1001", so they never
collide with real Shopify orders and are easy to remove. They exist only in ShopSync's database,
not in Shopify. Re-running replaces the previous sample orders.
"""

import random
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from sync import services
from sync.models import Order, Shop, Variant

SAMPLE_ID_BASE = 9_000_000_000_000_000


def build_orders(variants, days=59, seed=11, now=None, currency="USD"):
    """Return order dicts (services.upsert_order format): ~2x more orders recently than before."""
    rng = random.Random(seed)
    now = now or timezone.now()
    products = sorted({v.product_id for v in variants})
    rng.shuffle(products)
    popularity = {pid: 1 / (rank + 1) ** 0.8 for rank, pid in enumerate(products)}
    weights = [popularity[v.product_id] for v in variants]

    orders = []
    n = 0
    for back in range(days, -1, -1):  # oldest first so order numbers increase over time
        day = (now - timedelta(days=back)).date()
        base = 1.2 if back >= 30 else 2.4  # recent 30 days busier: the dashboard shows growth
        if day.weekday() >= 4:  # Friday to Sunday bump
            base *= 1.4
        for _ in range(max(0, round(rng.gauss(base, 0.9)))):
            lines, total = [], 0
            for v in rng.choices(variants, weights=weights, k=rng.choice([1, 1, 1, 2, 2, 3])):
                qty = rng.choice([1, 1, 1, 2, 2, 3])
                price = float(v.price)
                total += price * qty
                lines.append(
                    {
                        "variant_id": v.shopify_id,
                        "sku": v.sku,
                        "title": f"{v.product.title} - {v.title}",
                        "quantity": qty,
                        "price": price,
                    }
                )
            created = now.replace(hour=rng.randint(7, 22), minute=rng.randint(0, 59)) - timedelta(
                days=back
            )
            if created > now:
                created = now - timedelta(minutes=rng.randint(5, 240))
            fulfilled = back > 3 and rng.random() < 0.9
            status = rng.choices(["paid", "pending", "refunded"], weights=[90, 6, 4])[0]
            n += 1
            orders.append(
                {
                    "id": SAMPLE_ID_BASE + n,
                    "name": f"#D{1000 + n}",
                    "total_price": round(total, 2),
                    "currency": currency,
                    "financial_status": status,
                    "fulfillment_status": "fulfilled" if fulfilled else "unfulfilled",
                    "created_at": created.isoformat(),
                    "line_items": lines,
                }
            )
    return orders


class Command(BaseCommand):
    help = "Create sample order history for a shop from its real synced variants (demo only)."

    def add_arguments(self, parser):
        parser.add_argument("--shop", required=True)
        parser.add_argument("--days", type=int, default=59)

    def handle(self, *args, **opts):
        shop = Shop.objects.filter(domain=opts["shop"]).first()
        if not shop:
            raise CommandError("No such shop. Install the app on it first.")
        variants = list(Variant.objects.filter(product__shop=shop).select_related("product"))
        if not variants:
            raise CommandError("The shop has no synced products yet.")
        removed, _ = Order.objects.filter(shop=shop, shopify_id__gte=SAMPLE_ID_BASE).delete()
        orders = build_orders(variants, days=opts["days"], currency=shop.currency)
        for data in orders:
            services.upsert_order(shop, data)
        msg = f"Replaced {removed} old rows with {len(orders)} sample orders for {shop.domain}"
        self.stdout.write(self.style.SUCCESS(msg))
