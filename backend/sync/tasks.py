from celery import shared_task


@shared_task
def post_install(shop_id: int):
    """Register webhooks and kick off the first full sync (implemented in Phase 2)."""
    return shop_id
