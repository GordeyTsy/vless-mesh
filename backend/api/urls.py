from django.urls import path

from . import views

urlpatterns = [
    path("status", views.status, name="status"),
    path("stats", views.stats, name="stats"),
    path("nodes", views.nodes, name="nodes"),
    path("login", views.login, name="login"),
    path("requests", views.create_request, name="create_request"),
    path("requests/list", views.list_requests, name="list_requests"),
    path("requests/<int:req_id>/<str:action>", views.request_action, name="request_action"),
]
