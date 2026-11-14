from django.urls import path

from . import views

urlpatterns = [
    path("auth/install", views.install, name="install"),
    path("auth/callback", views.callback, name="callback"),
]
