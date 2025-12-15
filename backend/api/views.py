import os
import secrets
import json
from datetime import datetime

from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseForbidden
from django.views.decorators.http import require_GET, require_http_methods
from django.views.decorators.csrf import csrf_exempt

from .models import AccessRequest


def _demo_status():
    return {
        "mesh": "mesh",
        "healthy": True,
        "peer_count": 12,
        "registry": {
            "reachable": True,
            "last_sync": "PT2M",
            "token_valid": True,
        },
        "reality": {
            "dest": "www.microsoft.com:443",
            "short_id": "a1b2c3",
            "public_key": "PUB_REPLACEME",
        },
        "services": {
            "xray": "running",
            "tinc": "running",
            "registry": "running",
        },
        "mtu": 1400,
    }


def _demo_stats():
    return {
        "peers_online": 12,
        "best_iperf_mbps": 940,
        "median_rtt_ms": 14,
        "mtu": 1400,
    }


def _demo_nodes():
    nodes = [
        {"id": "hub", "label": "hub", "role": "server", "x": 0.5, "y": 0.38},
        {"id": "edge-1", "label": "edge-1", "role": "client", "x": 0.28, "y": 0.24},
        {"id": "edge-2", "label": "edge-2", "role": "client", "x": 0.68, "y": 0.22},
        {"id": "edge-3", "label": "edge-3", "role": "client", "x": 0.22, "y": 0.58},
        {"id": "edge-4", "label": "edge-4", "role": "client", "x": 0.72, "y": 0.55},
    ]
    links = [
        {"source": "hub", "target": "edge-1"},
        {"source": "hub", "target": "edge-2"},
        {"source": "hub", "target": "edge-3"},
        {"source": "hub", "target": "edge-4"},
        {"source": "edge-1", "target": "edge-3"},
        {"source": "edge-2", "target": "edge-4"},
    ]
    return {"nodes": nodes, "links": links}


def _admin_ok(request) -> bool:
    token = os.getenv("MESH_ADMIN_TOKEN", "mesh-admin")
    provided = request.headers.get("X-Mesh-Admin-Token") or request.GET.get("admin_token")
    return bool(provided) and secrets.compare_digest(token, provided)


def _json_body(request):
    try:
        return json.loads(request.body or "{}")
    except Exception:
        return None


@require_GET
def status(request):
    return JsonResponse(_demo_status())


@require_GET
def stats(request):
    return JsonResponse(_demo_stats())


@require_GET
def nodes(request):
    return JsonResponse(_demo_nodes())


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    data = _json_body(request)
    if not data:
        return HttpResponseBadRequest("bad json")
    email = (data.get("email") or "").strip().lower()
    token = (data.get("password") or data.get("token") or "").strip()
    if not email or not token:
        return HttpResponseBadRequest("email and token required")
    try:
        req = AccessRequest.objects.get(email=email)
    except AccessRequest.DoesNotExist:
        return HttpResponseForbidden("no request found")
    if req.status != "approved":
        return HttpResponseForbidden("not approved")
    if not req.access_key or not secrets.compare_digest(req.access_key, token):
        return HttpResponseForbidden("invalid token")
    return JsonResponse({"ok": True, "email": email, "status": req.status})


@csrf_exempt
@require_http_methods(["POST"])
def create_request(request):
    data = _json_body(request)
    if not data:
        return HttpResponseBadRequest("bad json")
    email = (data.get("email") or "").strip().lower()
    comment = (data.get("comment") or "").strip()
    if not email:
        return HttpResponseBadRequest("email required")
    req, created = AccessRequest.objects.get_or_create(email=email, defaults={"comment": comment})
    if not created:
        # reset to pending on re-apply
        req.comment = comment or req.comment
        req.status = "pending"
        req.access_key = ""
        req.save()
    return JsonResponse(
        {
            "ok": True,
            "id": req.id,
            "status": req.status,
            "created": req.created_at,
        }
    )


@require_GET
def list_requests(request):
    if not _admin_ok(request):
        return HttpResponseForbidden("admin token required")
    items = [
        {
            "id": r.id,
            "email": r.email,
            "comment": r.comment,
            "status": r.status,
            "access_key": r.access_key,
            "created": r.created_at,
            "updated": r.updated_at,
            "approved_at": r.approved_at,
        }
        for r in AccessRequest.objects.all()
    ]
    return JsonResponse({"requests": items})


@csrf_exempt
@require_http_methods(["POST"])
def request_action(request, req_id: int, action: str):
    if not _admin_ok(request):
        return HttpResponseForbidden("admin token required")
    try:
        req = AccessRequest.objects.get(id=req_id)
    except AccessRequest.DoesNotExist:
        return HttpResponseBadRequest("not found")
    if action not in ("approve", "decline"):
        return HttpResponseBadRequest("bad action")
    if action == "approve":
        req.status = "approved"
        req.access_key = secrets.token_hex(8)
        req.approved_at = datetime.utcnow()
    else:
        req.status = "declined"
        req.access_key = ""
    req.save()
    return JsonResponse(
        {
            "ok": True,
            "id": req.id,
            "status": req.status,
            "access_key": req.access_key if action == "approve" else None,
        }
    )
