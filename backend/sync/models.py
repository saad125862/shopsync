from django.db import models

from .crypto import decrypt, encrypt


class Shop(models.Model):
    domain = models.CharField(max_length=255, unique=True)
    access_token_enc = models.TextField(blank=True, default="")
    scope = models.CharField(max_length=500, blank=True, default="")
    is_active = models.BooleanField(default=True)
    installed_at = models.DateTimeField(auto_now_add=True)
    uninstalled_at = models.DateTimeField(null=True, blank=True)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    alert_email = models.EmailField(blank=True, default="")

    def __str__(self):
        return self.domain

    @property
    def access_token(self) -> str:
        return decrypt(self.access_token_enc) if self.access_token_enc else ""

    @access_token.setter
    def access_token(self, value: str):
        self.access_token_enc = encrypt(value) if value else ""


class Location(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="locations")
    shopify_id = models.BigIntegerField()
    name = models.CharField(max_length=255)
    active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("shop", "shopify_id")

    def __str__(self):
        return self.name


class Product(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="products")
    shopify_id = models.BigIntegerField()
    title = models.CharField(max_length=500)
    vendor = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=32, blank=True, default="")
    image_url = models.URLField(max_length=1000, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("shop", "shopify_id")

    def __str__(self):
        return self.title


class Variant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    shopify_id = models.BigIntegerField()
    inventory_item_id = models.BigIntegerField(null=True, blank=True)
    sku = models.CharField(max_length=255, blank=True, default="")
    title = models.CharField(max_length=255, blank=True, default="")
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        unique_together = ("product", "shopify_id")
        indexes = [models.Index(fields=["inventory_item_id"])]

    def __str__(self):
        return f"{self.product.title} / {self.title}"


class InventoryLevel(models.Model):
    variant = models.ForeignKey(Variant, on_delete=models.CASCADE, related_name="levels")
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="levels")
    available = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("variant", "location")


class Order(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="orders")
    shopify_id = models.BigIntegerField()
    name = models.CharField(max_length=64)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, blank=True, default="")
    financial_status = models.CharField(max_length=32, blank=True, default="")
    fulfillment_status = models.CharField(max_length=32, blank=True, default="")
    created_at_shopify = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("shop", "shopify_id")
        ordering = ["-created_at_shopify"]


class OrderLine(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="lines")
    shopify_variant_id = models.BigIntegerField(null=True, blank=True)
    sku = models.CharField(max_length=255, blank=True, default="")
    title = models.CharField(max_length=500, blank=True, default="")
    quantity = models.PositiveIntegerField(default=1)


class WebhookEvent(models.Model):
    class Status(models.TextChoices):
        RECEIVED = "received"
        PROCESSED = "processed"
        FAILED = "failed"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="webhook_events")
    webhook_id = models.CharField(max_length=128, unique=True)
    topic = models.CharField(max_length=128)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RECEIVED)
    error = models.TextField(blank=True, default="")
    attempts = models.PositiveIntegerField(default=0)
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)


class SyncLog(models.Model):
    class Status(models.TextChoices):
        RUNNING = "running"
        OK = "ok"
        FAILED = "failed"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="sync_logs")
    kind = models.CharField(max_length=64)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RUNNING)
    detail = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]


class AlertRule(models.Model):
    """Per-SKU or per-location threshold override. Falls back to Shop.low_stock_threshold."""

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="alert_rules")
    variant = models.ForeignKey(Variant, null=True, blank=True, on_delete=models.CASCADE)
    location = models.ForeignKey(Location, null=True, blank=True, on_delete=models.CASCADE)
    threshold = models.PositiveIntegerField(default=5)


class Alert(models.Model):
    class Level(models.TextChoices):
        LOW = "low"
        OUT = "out"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="alerts")
    variant = models.ForeignKey(Variant, on_delete=models.CASCADE, related_name="alerts")
    location = models.ForeignKey(Location, on_delete=models.CASCADE, related_name="alerts")
    level = models.CharField(max_length=8, choices=Level.choices)
    available = models.IntegerField()
    threshold = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class DeviceToken(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="device_tokens")
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
