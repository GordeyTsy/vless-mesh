from django.http import JsonResponse
from django.views.decorators.http import require_GET


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


@require_GET
def status(request):
    return JsonResponse(_demo_status())


@require_GET
def stats(request):
    return JsonResponse(_demo_stats())


@require_GET
def nodes(request):
    return JsonResponse(_demo_nodes())

# Create your views here.
