"""Push the demo catalog to a REAL (development) Shopify store, or create test orders.

    python manage.py seed_shopify --shop xyz.myshopify.com            # create products
    python manage.py seed_shopify --shop xyz.myshopify.com --orders 5  # create test orders

Requires the app to be installed on the store (an access token must exist) and the
write_products / write_inventory / write_orders scopes for the respective actions.
"""

import random

from django.core.management.base import BaseCommand, CommandError

from sync import demo_data
from sync.models import Shop
from sync.shopify import GraphQLClient

LOCATIONS_Q = "{ locations(first: 20) { edges { node { id name } } } }"

PRODUCT_SET_M = """
mutation($input: ProductSetInput!) {
  productSet(synchronous: true, input: $input) {
    product { id title variants(first: 100) { edges { node { id sku } } } }
    userErrors { field message }
  }
}"""

DRAFT_CREATE_M = """
mutation($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) { draftOrder { id } userErrors { field message } }
}"""

DRAFT_COMPLETE_M = """
mutation($id: ID!) {
  draftOrderComplete(id: $id, paymentPending: true) {
    draftOrder { id order { id name } }
    userErrors { field message }
  }
}"""

VARIANTS_Q = "{ productVariants(first: 100) { edges { node { id sku } } } }"


def product_set_input(product: dict, location_ids: dict) -> dict:
    """Build a productSet input for one catalog product (pure function, unit-tested)."""
    option_names = ["Size", "Color"]
    sizes, colors = [], []
    rows = []
    for v in product["variants"]:
        # title is "SIZE / COLOR" or just COLOR for one-size items
        parts = v["title"].split(" / ")
        size, color = (parts[0], parts[1]) if len(parts) == 2 else ("One Size", parts[0])
        if size not in sizes:
            sizes.append(size)
        if color not in colors:
            colors.append(color)
        rows.append((size, color, v))
    return {
        "title": product["title"],
        "vendor": product["vendor"],
        "status": "ACTIVE",
        "productOptions": [
            {"name": option_names[0], "values": [{"name": s} for s in sizes]},
            {"name": option_names[1], "values": [{"name": c} for c in colors]},
        ],
        "variants": [
            {
                "optionValues": [
                    {"optionName": "Size", "name": size},
                    {"optionName": "Color", "name": color},
                ],
                "sku": v["sku"],
                "price": str(v["price"]),
                "inventoryItem": {"tracked": True},
                "inventoryQuantities": [
                    {"locationId": location_ids[name], "name": "available", "quantity": qty}
                    for name, qty in v["stock"].items()
                    if name in location_ids
                ],
            }
            for size, color, v in rows
        ],
    }


class Command(BaseCommand):
    help = "Create demo products or test orders in a real dev store."

    def add_arguments(self, parser):
        parser.add_argument("--shop", required=True)
        parser.add_argument("--orders", type=int, default=0)

    def handle(self, *args, **opts):
        shop = Shop.objects.filter(domain=opts["shop"], is_active=True).first()
        if not shop or not shop.access_token:
            raise CommandError("Install the app on this store first (no access token).")
        client = GraphQLClient(shop.domain, shop.access_token)
        if opts["orders"]:
            return self.create_orders(client, opts["orders"])

        locs = client.execute(LOCATIONS_Q)["locations"]["edges"]
        if not locs:
            raise CommandError("Store has no locations")
        # Map our demo locations onto the first real locations, in order.
        location_ids = {
            name: locs[i % len(locs)]["node"]["id"]
            for i, (name, _) in enumerate(demo_data.LOCATIONS)
        }
        for p in demo_data.iter_variants():
            data = client.execute(PRODUCT_SET_M, {"input": product_set_input(p, location_ids)})
            errs = data["productSet"]["userErrors"]
            if errs:
                self.stderr.write(f"{p['title']}: {errs}")
            else:
                self.stdout.write(f"created {p['title']}")

    def create_orders(self, client, count):
        variants = [
            e["node"] for e in client.execute(VARIANTS_Q)["productVariants"]["edges"]
        ]
        if not variants:
            raise CommandError("No variants in store; create products first.")
        rng = random.Random()
        for _ in range(count):
            picks = rng.sample(variants, min(len(variants), rng.randint(1, 3)))
            draft = client.execute(
                DRAFT_CREATE_M,
                {
                    "input": {
                        "lineItems": [
                            {"variantId": v["id"], "quantity": rng.randint(1, 2)} for v in picks
                        ]
                    }
                },
            )["draftOrderCreate"]
            if draft["userErrors"]:
                self.stderr.write(str(draft["userErrors"]))
                continue
            done = client.execute(DRAFT_COMPLETE_M, {"id": draft["draftOrder"]["id"]})
            order = done["draftOrderComplete"]["draftOrder"]["order"]
            self.stdout.write(f"created order {order['name']}")
