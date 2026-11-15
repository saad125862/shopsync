"""Populate the LOCAL database with demo data (no Shopify call). Idempotent."""

import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from sync import demo_data, services
from sync.models import Location, Order, Shop


class Command(BaseCommand):
    help = "Seed a demo shop with apparel products, inventory levels, alerts and orders."

    def add_arguments(self, parser):
        parser.add_argument("--shop", default="demo-store.myshopify.com")
        parser.add_argument("--orders", type=int, default=60)

    def handle(self, *args, **opts):
        shop, _ = Shop.objects.get_or_create(
            domain=opts["shop"], defaults={"alert_email": "owner@example.com"}
        )
        locs = {
            name: services.upsert_location(shop, sid, name) for name, sid in demo_data.LOCATIONS
        }
        n_variants = 0
        flat = []
        for p in demo_data.iter_variants():
            payload = {
                "id": p["id"],
                "title": p["title"],
                "vendor": p["vendor"],
                "status": "active",
                "image": "",
                "variants": [
                    {
                        "id": v["id"],
                        "title": v["title"],
                        "sku": v["sku"],
                        "price": v["price"],
                        "inventory_item_id": v["inventory_item_id"],
                        "levels": [
                            {"location_id": locs[name].shopify_id, "available": qty}
                            for name, qty in v["stock"].items()
                        ],
                    }
                    for v in p["variants"]
                ],
            }
            services.upsert_product(shop, payload)
            n_variants += len(p["variants"])
            flat += [(p["title"], v) for v in p["variants"]]

        rng = random.Random(7)
        now = timezone.now()
        for i in range(opts["orders"]):
            lines = []
            total = 0
            for title, v in rng.sample(flat, rng.randint(1, 3)):
                qty = rng.randint(1, 3)
                total += v["price"] * qty
                lines.append(
                    {
                        "variant_id": v["id"],
                        "sku": v["sku"],
                        "title": f"{title} - {v['title']}",
                        "quantity": qty,
                        "price": v["price"],
                    }
                )
            created = now - timedelta(days=rng.randint(0, 28), hours=rng.randint(0, 23))
            services.upsert_order(
                shop,
                {
                    "id": 90000 + i,
                    "name": f"#{1001 + i}",
                    "total_price": total,
                    "currency": "USD",
                    "financial_status": "paid",
                    "fulfillment_status": rng.choice(["fulfilled", "unfulfilled"]),
                    "created_at": created.isoformat(),
                    "line_items": lines,
                },
            )
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {shop.domain}: {len(demo_data.CATALOG)} products, {n_variants} variants, "
                f"{Location.objects.filter(shop=shop).count()} locations, "
                f"{Order.objects.filter(shop=shop).count()} orders, "
                f"{shop.alerts.filter(resolved_at__isnull=True).count()} open alerts"
            )
        )
