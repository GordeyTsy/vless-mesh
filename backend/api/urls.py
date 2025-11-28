from django.urls import path

from . import views

urlpatterns = [
    path("status", views.status, name="status"),
    path("stats", views.stats, name="stats"),
    path("nodes", views.nodes, name="nodes"),
]
