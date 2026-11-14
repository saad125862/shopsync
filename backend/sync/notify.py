"""Alert notifications: email + Expo push (best effort, never raises)."""

import logging

import requests
from django.conf import settings
from django.core.mail import send_mail

log = logging.getLogger(__name__)
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def alert_text(alert) -> str:
    state = "OUT OF STOCK" if alert.level == "out" else "LOW STOCK"
    return (
        f"{state}: {alert.variant.product.title} / {alert.variant.title} "
        f"at {alert.location.name} ({alert.available} left, threshold {alert.threshold})"
    )


def notify_alert(alert) -> None:
    text = alert_text(alert)
    shop = alert.shop
    if shop.alert_email:
        try:
            send_mail(
                f"[ShopSync] {text[:60]}",
                text,
                settings.DEFAULT_FROM_EMAIL,
                [shop.alert_email],
                fail_silently=True,
            )
        except Exception:  # noqa: BLE001
            log.exception("alert email failed")
    tokens = list(shop.device_tokens.values_list("token", flat=True))
    if tokens:
        try:
            requests.post(
                EXPO_PUSH_URL,
                json=[{"to": t, "title": "ShopSync", "body": text} for t in tokens],
                timeout=10,
            )
        except Exception:  # noqa: BLE001
            log.exception("push failed")
