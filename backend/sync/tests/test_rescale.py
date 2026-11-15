import pytest
from django.core.management import call_command

from sync.management.commands import rescale_prices
from sync.models import Shop


def node(title, prices):
    return {
        "id": f"gid://shopify/Product/{abs(hash(title)) % 1000}",
        "title": title,
        "variants": {
            "edges": [
                {"node": {"id": f"gid://shopify/ProductVariant/{i}", "price": str(p)}}
                for i, p in enumerate(prices)
            ]
        },
    }


class FakeClient:
    def __init__(self, nodes):
        self.nodes = nodes
        self.updates = []

    def paginate(self, query, path, variables=None):
        return iter(self.nodes)

    def execute(self, query, variables=None):
        self.updates.append(variables)
        return {"productVariantsBulkUpdate": {"userErrors": []}}


class _Null:
    def write(self, *_a, **_k):
        pass

    def flush(self):
        pass


def test_new_price_rounds_to_a_friendly_step():
    assert rescale_prices.new_price(18) == 2150
    assert rescale_prices.new_price(49) == 5900
    assert rescale_prices.new_price(0.1) == 50  # never zero


@pytest.fixture
def shop(db):
    s = Shop(domain="x.myshopify.com")
    s.access_token = "tok"
    s.save()
    return s


def run(monkeypatch, client, **opts):
    monkeypatch.setattr(rescale_prices, "GraphQLClient", lambda *a, **k: client)
    call_command("rescale_prices", shop="x.myshopify.com", stdout=_Null(), **opts)


def test_dry_run_changes_nothing(shop, monkeypatch):
    client = FakeClient([node("Tee", [18, 20])])
    run(monkeypatch, client)
    assert client.updates == []


def test_apply_rescales_and_skips_already_scaled(shop, monkeypatch):
    client = FakeClient([node("Tee", [18, 20]), node("Hoodie", [2900, 3000])])
    run(monkeypatch, client, apply=True)
    assert len(client.updates) == 1  # the already-scaled Hoodie is untouched
    assert [v["price"] for v in client.updates[0]["variants"]] == ["2150", "2400"]


def test_running_twice_does_not_multiply_again(shop, monkeypatch):
    client = FakeClient([node("Tee", [2150, 2400])])
    run(monkeypatch, client, apply=True)
    assert client.updates == []
