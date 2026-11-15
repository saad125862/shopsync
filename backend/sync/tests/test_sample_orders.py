import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from sync import services
from sync.management.commands.seed_sample_orders import SAMPLE_ID_BASE
from sync.models import Order, Shop

DOMAIN = "demo-store.myshopify.com"


class _Null:
    def write(self, *_a, **_k):
        pass

    def flush(self):
        pass


@pytest.fixture(autouse=True)
def mail(settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"


@pytest.fixture
def shop(db):
    # products and variants only: drop the seeded orders so we test the sample orders alone
    call_command("seed_demo", orders=0, stdout=_Null())
    return Shop.objects.get(domain=DOMAIN)


def test_requires_a_shop_with_products(db):
    with pytest.raises(CommandError):
        call_command("seed_sample_orders", shop="nope.myshopify.com")
    Shop.objects.create(domain="empty.myshopify.com")
    with pytest.raises(CommandError):
        call_command("seed_sample_orders", shop="empty.myshopify.com")


def test_creates_realistic_orders_and_is_idempotent(shop):
    call_command("seed_sample_orders", shop=DOMAIN, stdout=_Null())
    count = Order.objects.filter(shop=shop).count()
    assert 80 <= count <= 400
    assert Order.objects.filter(shop=shop, shopify_id__lt=SAMPLE_ID_BASE).count() == 0
    assert all(o.name.startswith("#D") for o in Order.objects.filter(shop=shop)[:20])
    first = Order.objects.filter(shop=shop).first()
    assert first.lines.count() >= 1 and all(li.price > 0 for li in first.lines.all())
    assert float(first.total_price) == pytest.approx(
        sum(float(li.price) * li.quantity for li in first.lines.all()), abs=0.01
    )
    call_command("seed_sample_orders", shop=DOMAIN, stdout=_Null())
    assert Order.objects.filter(shop=shop).count() == count  # replaced, not duplicated


def test_does_not_touch_real_orders(shop):
    services.upsert_order(
        shop,
        {"id": 5001, "name": "#1001", "total_price": "10.00", "created_at": "2026-01-01T00:00:00Z"},
    )
    call_command("seed_sample_orders", shop=DOMAIN, stdout=_Null())
    assert Order.objects.filter(shop=shop, shopify_id=5001).exists()
    call_command("seed_sample_orders", shop=DOMAIN, stdout=_Null())
    assert Order.objects.filter(shop=shop, shopify_id=5001).count() == 1


def test_recent_period_is_busier_so_the_dashboard_shows_growth(shop):
    from datetime import timedelta

    from django.utils import timezone

    call_command("seed_sample_orders", shop=DOMAIN, stdout=_Null())
    now = timezone.now()
    recent = Order.objects.filter(shop=shop, created_at_shopify__gte=now - timedelta(days=30)).count()
    earlier = Order.objects.filter(
        shop=shop,
        created_at_shopify__lt=now - timedelta(days=30),
        created_at_shopify__gte=now - timedelta(days=60),
    ).count()
    assert recent > earlier > 0
