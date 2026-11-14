from django.contrib import admin

from . import models

for m in (
    models.Shop,
    models.Location,
    models.Product,
    models.Variant,
    models.InventoryLevel,
    models.Order,
    models.WebhookEvent,
    models.SyncLog,
    models.AlertRule,
    models.Alert,
    models.DeviceToken,
):
    admin.site.register(m)
