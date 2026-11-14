from django.urls import path

from . import views, webhooks

urlpatterns = [
    path("auth/install", views.install, name="install"),
    path("auth/callback", views.callback, name="callback"),
    path("webhooks/shopify", webhooks.receive, name="webhook"),
    path("webhooks/gdpr", webhooks.gdpr, name="webhook-gdpr"),
]
