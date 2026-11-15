import logging

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from . import services
from .models import Shop, WebhookEvent

log = logging.getLogger(__name__)


@shared_task
def post_install(shop_id: int):
    """Register webhooks, then run the first full sync."""
    shop = Shop.objects.get(id=shop_id)
    services.register_webhooks(shop, f"{settings.APP_URL}/webhooks/shopify")
    services.full_sync(shop)
    return shop_id


@shared_task
def full_sync_task(shop_id: int):
    shop = Shop.objects.get(id=shop_id, is_active=True)
    return services.full_sync(shop).id


@shared_task(bind=True, max_retries=5)
def process_webhook_event(self, event_id: int):
    from .webhooks import dispatch

    event = WebhookEvent.objects.select_related("shop").get(id=event_id)
    if event.status == WebhookEvent.Status.PROCESSED:
        return
    event.attempts += 1
    try:
        dispatch(event)
    except Exception as exc:
        event.status = WebhookEvent.Status.FAILED
        event.error = str(exc)[:2000]
        event.save()
        if self.request.is_eager:
            raise
        raise self.retry(exc=exc, countdown=2**self.request.retries * 5) from exc
    event.status = WebhookEvent.Status.PROCESSED
    event.error = ""
    event.processed_at = timezone.now()
    event.save()


@shared_task
def reconcile_all():
    from .reconcile import reconcile

    count = 0
    for shop in Shop.objects.filter(is_active=True).exclude(access_token_enc=""):
        try:
            reconcile(shop)
            count += 1
        except Exception:
            log.exception("reconcile failed for %s", shop.domain)
    return count


@shared_task
def replay_failed_events():
    ids = list(
        WebhookEvent.objects.filter(status=WebhookEvent.Status.FAILED).values_list("id", flat=True)
    )
    for i in ids:
        process_webhook_event.delay(i)
    return len(ids)
