"""Low-stock alert evaluation."""

from django.utils import timezone

from .models import Alert, AlertRule, InventoryLevel


def threshold_for(level: InventoryLevel) -> int:
    shop = level.location.shop
    rules = AlertRule.objects.filter(shop=shop)
    rule = (
        rules.filter(variant=level.variant, location=level.location).first()
        or rules.filter(variant=level.variant, location__isnull=True).first()
        or rules.filter(location=level.location, variant__isnull=True).first()
    )
    return rule.threshold if rule else shop.low_stock_threshold


def evaluate_level(level: InventoryLevel) -> Alert | None:
    """Open/resolve alerts for one inventory level. Returns a newly created alert, if any."""
    shop = level.location.shop
    threshold = threshold_for(level)
    if level.available <= 0:
        wanted = Alert.Level.OUT
    elif level.available <= threshold:
        wanted = Alert.Level.LOW
    else:
        wanted = None

    open_alerts = Alert.objects.filter(
        shop=shop, variant=level.variant, location=level.location, resolved_at__isnull=True
    )
    if wanted is None:
        open_alerts.update(resolved_at=timezone.now())
        return None
    if open_alerts.filter(level=wanted).exists():
        return None
    open_alerts.update(resolved_at=timezone.now())
    alert = Alert.objects.create(
        shop=shop,
        variant=level.variant,
        location=level.location,
        level=wanted,
        available=level.available,
        threshold=threshold,
    )
    from .notify import notify_alert

    notify_alert(alert)
    return alert
