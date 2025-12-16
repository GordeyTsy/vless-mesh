#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

k() {
  env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy -u ALL_PROXY -u all_proxy kubectl "$@"
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

require_cmd kubectl
require_cmd python3

SERVER_ADDR="${MESH_SERVER_ADDR:-}" # where clients reach the mesh registry/vless server
MESH_TOKEN="${MESH_TOKEN:-}"        # registry token
MESH_UUID="${MESH_UUID:-}"          # shared mesh UUID

MESH_SERVER_IP="${MESH_SERVER_IP:-10.10.0.1}"
MESH_VLESS_PORT="${MESH_VLESS_PORT:-443}"
MESH_TINC_PORT="${MESH_TINC_PORT:-6060}"
MESH_MTU="${MESH_MTU:-1400}"
MESH_REALITY_DEST="${MESH_REALITY_DEST:-www.microsoft.com:443}"
MESH_REG_PORT="${MESH_REG_PORT:-9000}"

detect_pub_addr() {
  local addr="${MESH_PUB_ADDR:-}"
  if [[ -n "${addr}" ]]; then
    echo "${addr}"
    return
  fi
  if [[ -f /etc/kubernetes/admin.conf ]]; then
    addr="$(awk '/server:/{print $2; exit}' /etc/kubernetes/admin.conf | sed 's#https\\?://##; s#:6443##')"
    if [[ -n "${addr}" ]]; then
      echo "${addr}"
      return
    fi
  fi
  hostname -I 2>/dev/null | awk '{print $1}' || true
}

detect_control_plane_node() {
  local name
  name="$(k get nodes -l node-role.kubernetes.io/control-plane -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  [[ -n "${name}" ]] && { echo "${name}"; return; }
  k get nodes -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true
}

apply_mesh_server() {
  local node pub_addr
  node="$(detect_control_plane_node)"
  [[ -n "${node}" ]] || die "Cannot detect control-plane node name"
  pub_addr="$(detect_pub_addr)"
  [[ -n "${pub_addr}" ]] || die "Cannot detect PUB_ADDR (set MESH_PUB_ADDR)"

  echo "[vless-mesh] Applying mesh-server Deployment on ${node} (PUB_ADDR=${pub_addr})..."
  k create ns vless-mesh --dry-run=client -o yaml | k apply -f -

  cat <<YAML | k apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mesh-server
  namespace: vless-mesh
  labels:
    app: vless-mesh-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: vless-mesh-server
  template:
    metadata:
      labels:
        app: vless-mesh-server
    spec:
      nodeSelector:
        kubernetes.io/hostname: ${node}
      hostNetwork: true
      dnsPolicy: ClusterFirstWithHostNet
      containers:
        - name: mesh-server
          image: registry:443/vless-mesh-server:latest
          imagePullPolicy: IfNotPresent
          securityContext:
            privileged: true
            capabilities:
              add: ["NET_ADMIN","NET_RAW"]
          env:
            - name: MESH_IP
              value: "${MESH_SERVER_IP}"
            - name: PUB_ADDR
              value: "${pub_addr}"
            - name: VLESS_PORT
              value: "${MESH_VLESS_PORT}"
            - name: TINC_PORT
              value: "${MESH_TINC_PORT}"
            - name: MTU
              value: "${MESH_MTU}"
            - name: REALITY_DEST
              value: "${MESH_REALITY_DEST}"
            - name: REG_PORT
              value: "${MESH_REG_PORT}"
          volumeMounts:
            - name: tinc
              mountPath: /etc/tinc/mesh
            - name: xray
              mountPath: /usr/local/etc/xray
            - name: vless
              mountPath: /etc/vless-mesh
            - name: dev-net-tun
              mountPath: /dev/net/tun
      volumes:
        - name: tinc
          hostPath:
            path: /etc/tinc/mesh
            type: DirectoryOrCreate
        - name: xray
          hostPath:
            path: /usr/local/etc/xray
            type: DirectoryOrCreate
        - name: vless
          hostPath:
            path: /etc/vless-mesh
            type: DirectoryOrCreate
        - name: dev-net-tun
          hostPath:
            path: /dev/net/tun
            type: CharDevice
YAML

  k -n vless-mesh rollout status deploy/mesh-server --timeout=180s || true
}

ensure_mesh_server() {
  if k -n vless-mesh get deploy mesh-server >/dev/null 2>&1; then
    return 0
  fi
  apply_mesh_server
}

if [[ -z "${MESH_TOKEN}" && -f /etc/vless-mesh/token ]]; then
  MESH_TOKEN="$(cat /etc/vless-mesh/token | tr -d '\n')"
fi

if [[ -f /etc/vless-mesh/peers.json ]]; then
  if [[ -z "${MESH_UUID}" ]]; then
    MESH_UUID="$(
      python3 -c 'import json; print(json.load(open("/etc/vless-mesh/peers.json")).get("uuid",""))' 2>/dev/null || true
    )"
  fi
  if [[ -z "${SERVER_ADDR}" ]]; then
    SERVER_ADDR="$(
      python3 -c 'import json; d=json.load(open("/etc/vless-mesh/peers.json")); \
peers=d.get("peers",[]); \
print(next((p.get("pub_addr","") for p in peers if p.get("name")=="server"), ""))' 2>/dev/null || true
    )"
  fi
fi

if [[ -z "${SERVER_ADDR}" || -z "${MESH_TOKEN}" || -z "${MESH_UUID}" ]]; then
  ensure_mesh_server
fi

if [[ -z "${MESH_TOKEN}" || -z "${MESH_UUID}" || -z "${SERVER_ADDR}" ]]; then
  echo "[vless-mesh] Waiting for /etc/vless-mesh/token + peers.json..."
  for _ in {1..90}; do
    if [[ -z "${MESH_TOKEN}" && -s /etc/vless-mesh/token ]]; then
      MESH_TOKEN="$(cat /etc/vless-mesh/token | tr -d '\n' || true)"
    fi
    if [[ -f /etc/vless-mesh/peers.json ]]; then
      [[ -z "${MESH_UUID}" ]] && MESH_UUID="$(python3 -c 'import json; print(json.load(open("/etc/vless-mesh/peers.json")).get("uuid",""))' 2>/dev/null || true)"
      [[ -z "${SERVER_ADDR}" ]] && SERVER_ADDR="$(python3 -c 'import json; d=json.load(open("/etc/vless-mesh/peers.json")); peers=d.get("peers",[]); print(next((p.get("pub_addr","") for p in peers if p.get("name")=="server"), \"\"))' 2>/dev/null || true)"
    fi
    [[ -n "${MESH_TOKEN}" && -n "${MESH_UUID}" && -n "${SERVER_ADDR}" ]] && break
    sleep 2
  done
fi

[[ -n "${SERVER_ADDR}" ]] || die "SERVER_ADDR missing after mesh-server start"
[[ -n "${MESH_TOKEN}" ]] || die "MESH_TOKEN missing after mesh-server start"
[[ -n "${MESH_UUID}" ]] || die "MESH_UUID missing after mesh-server start"

echo "[vless-mesh] Ensuring namespace..."
k create ns vless-mesh --dry-run=client -o yaml | k apply -f -

echo "[vless-mesh] Applying mesh-client secret (server_addr/token/mesh_uuid)..."
k -n vless-mesh create secret generic mesh-client-secret \
  --from-literal=server_addr="${SERVER_ADDR}" \
  --from-literal=token="${MESH_TOKEN}" \
  --from-literal=mesh_uuid="${MESH_UUID}" \
  --dry-run=client -o yaml | k apply -f -

echo "[vless-mesh] Applying mesh-client DaemonSet..."
k apply -f "${SCRIPT_DIR}/k8s-mesh-client.yaml"

echo "[vless-mesh] Applying UI (backend + web)..."
k apply -f "${SCRIPT_DIR}/k8s-mesh-ui.yaml"
