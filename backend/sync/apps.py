from django.apps import AppConfig


class SyncConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "sync"

    def ready(self):
        from . import schema  # noqa: F401  (registers the OpenAPI auth scheme)
