"""Run a full sync for one shop, retrying if the database drops a connection."""

from django.core.management.base import BaseCommand, CommandError
from django.db import OperationalError, connection

from sync import services
from sync.models import Shop


class Command(BaseCommand):
    help = "Full sync (currency, locations, products, inventory, orders) for one shop."

    def add_arguments(self, parser):
        parser.add_argument("--shop", required=True)
        parser.add_argument("--retries", type=int, default=3)

    def handle(self, *args, **opts):
        shop = Shop.objects.filter(domain=opts["shop"], is_active=True).first()
        if not shop or not shop.access_token:
            raise CommandError("Install the app on this store first (no access token).")
        for attempt in range(1, opts["retries"] + 1):
            try:
                log = services.full_sync(shop)
                shop.refresh_from_db()
                self.stdout.write(
                    self.style.SUCCESS(f"{log.status}: {log.detail} (currency {shop.currency})")
                )
                return
            except OperationalError as exc:  # e.g. pooled connection closed mid-sync
                self.stderr.write(f"attempt {attempt} lost the database connection: {exc}")
                connection.close()
        raise CommandError("Sync failed after retries")
