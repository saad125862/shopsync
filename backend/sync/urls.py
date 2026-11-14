from django.urls import path

from . import api, views, webhooks

urlpatterns = [
    path("auth/install", views.install, name="install"),
    path("auth/callback", views.callback, name="callback"),
    path("webhooks/shopify", webhooks.receive, name="webhook"),
    path("webhooks/gdpr", webhooks.gdpr, name="webhook-gdpr"),
    # dashboard / mobile API
    path("api/overview", api.OverviewView.as_view()),
    path("api/inventory", api.InventoryListView.as_view()),
    path("api/inventory/<int:pk>/adjust", api.InventoryAdjustView.as_view()),
    path("api/orders", api.OrderListView.as_view()),
    path("api/alerts", api.AlertListView.as_view()),
    path("api/alert-rules", api.AlertRuleView.as_view()),
    path("api/sync", api.SyncLogView.as_view()),
    path("api/locations", api.LocationListView.as_view()),
    path("api/settings", api.SettingsView.as_view()),
    path("api/devices", api.DeviceView.as_view()),
    path("api/mobile-token", api.MobileTokenView.as_view()),
]
