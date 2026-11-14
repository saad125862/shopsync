"""Deterministic apparel catalog used by the seed commands."""

import random

SIZES = ["S", "M", "L", "XL"]

# (title, vendor, base price, colors, sizes)
CATALOG = [
    ("Classic Tee", "Dhaka Threads", 18, ["Black", "White", "Navy"], SIZES),
    ("Premium Hoodie", "Dhaka Threads", 49, ["Black", "Grey"], SIZES),
    ("Zip Hoodie", "Dhaka Threads", 54, ["Olive", "Black"], SIZES),
    ("Panjabi Cotton", "Jamdani House", 39, ["White", "Maroon", "Teal"], ["M", "L", "XL"]),
    ("Polo Shirt", "Dhaka Threads", 24, ["Navy", "White", "Red"], SIZES),
    ("Denim Jacket", "Blue Loom", 79, ["Indigo"], SIZES),
    ("Slim Chinos", "Blue Loom", 44, ["Khaki", "Navy"], ["30", "32", "34", "36"]),
    ("Cargo Pants", "Blue Loom", 52, ["Olive", "Black"], ["30", "32", "34", "36"]),
    ("Baseball Cap", "Capital Caps", 15, ["Black", "Blue", "Red"], ["One Size"]),
    ("Beanie", "Capital Caps", 12, ["Grey", "Black"], ["One Size"]),
    ("Canvas Tote", "Dhaka Threads", 14, ["Natural", "Black"], ["One Size"]),
    ("Leather Belt", "Blue Loom", 22, ["Brown", "Black"], ["M", "L"]),
    ("Running Shorts", "Sprint Co", 26, ["Black", "Grey"], SIZES),
    ("Track Jacket", "Sprint Co", 58, ["Navy", "Black"], SIZES),
    ("Wool Scarf", "Jamdani House", 28, ["Charcoal", "Mustard"], ["One Size"]),
    ("Linen Shirt", "Jamdani House", 42, ["Sand", "White", "Sky"], SIZES),
    ("Sports Socks 3-Pack", "Sprint Co", 11, ["White", "Black"], ["One Size"]),
    ("Graphic Tee", "Dhaka Threads", 21, ["Black", "White"], SIZES),
    ("Kurti Embroidered", "Jamdani House", 46, ["Pink", "Teal", "Maroon"], ["S", "M", "L"]),
    ("Sunglasses", "Capital Caps", 19, ["Black", "Tortoise"], ["One Size"]),
]

LOCATIONS = [("Dhaka Warehouse", 7001), ("Store Pickup", 7002)]


def iter_variants(seed: int = 42):
    """Yield dicts describing every variant with per-location stock.

    Stock mix per variant: ~15% out, ~20% low (1-5), the rest healthy.
    """
    rng = random.Random(seed)
    pid = 1000
    vid = 5000
    for title, vendor, price, colors, sizes in CATALOG:
        pid += 1
        variants = []
        prefix = "".join(w[0] for w in title.split()).upper()
        for color in colors:
            for size in sizes:
                vid += 1
                stock = {}
                for loc_name, _ in LOCATIONS:
                    roll = rng.random()
                    if roll < 0.15:
                        qty = 0
                    elif roll < 0.35:
                        qty = rng.randint(1, 5)
                    else:
                        qty = rng.randint(8, 60)
                    stock[loc_name] = qty
                variants.append(
                    {
                        "id": vid,
                        "inventory_item_id": vid + 100000,
                        "title": f"{size} / {color}" if size != "One Size" else color,
                        "sku": f"{prefix}-{color[:3].upper()}-{size}",
                        "price": price,
                        "stock": stock,
                    }
                )
        yield {"id": pid, "title": title, "vendor": vendor, "variants": variants}
