from django.urls import path

from . import api, catalog_api, views, webhooks

urlpatterns = [
    path("auth/install", views.install, name="install"),
    path("auth/callback", views.callback, name="callback"),
    path("webhooks/shopify", webhooks.receive, name="webhook"),
    path("webhooks/gdpr", webhooks.gdpr, name="webhook-gdpr"),
    # dashboard / mobile API
    path("api/overview", catalog_api.OverviewView.as_view()),
    path("api/products", catalog_api.ProductListView.as_view()),
    path("api/products/<int:pk>", catalog_api.ProductDetailView.as_view()),
    path("api/orders", catalog_api.OrderListView.as_view()),
    path("api/orders/<int:pk>", catalog_api.OrderDetailView.as_view()),
    path("api/search", catalog_api.SearchView.as_view()),
    path("api/inventory", api.InventoryListView.as_view()),
    path("api/inventory/<int:pk>/adjust", api.InventoryAdjustView.as_view()),
    path("api/alerts", api.AlertListView.as_view()),
    path("api/alert-rules", api.AlertRuleView.as_view()),
    path("api/sync", api.SyncLogView.as_view()),
    path("api/locations", api.LocationListView.as_view()),
    path("api/settings", api.SettingsView.as_view()),
    path("api/devices", api.DeviceView.as_view()),
    path("api/mobile-token", api.MobileTokenView.as_view()),
    path("api/demo-login", api.DemoLoginView.as_view()),
]
