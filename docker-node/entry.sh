#!/bin/bash
set -euo pipefail

MODE=${MODE:-client}
if [[ "$MODE" = "server" ]]; then
  ENABLE_REGISTRY=${ENABLE_REGISTRY:-0}
  ENABLE_IPERF=${ENABLE_IPERF:-1}
  tincd -n mesh -D &
  xray run -c /usr/local/etc/xray/config.json &
  if [ "$ENABLE_REGISTRY" = "1" ]; then
    if [[ -f /registry.py ]]; then
      python3 /registry.py /etc/vless-mesh/peers.json &
    elif [[ -x /usr/local/sbin/mesh-registry.py ]]; then
      python3 /usr/local/sbin/mesh-registry.py /etc/vless-mesh/peers.json &
    fi
  fi
  if [ "$ENABLE_IPERF" = "1" ]; then
    iperf3 -s -p 5201 &
  fi
  wait -n
  exit 0
fi

# Expect env: SERVER_ADDR, MESH_TOKEN, MESH_UUID, VLESS_PORT, TINC_PORT, FW_BASE, REG_PORT, REALITY_DEST, MESH_DIAL_ONLY
# Derive mesh IP from hostIP: 10.10.0.<last_octet>
HOST_IP="${NODE_IP:-$(hostname -I | awk '{print $1}')}"
LAST_OCT=$(echo "$HOST_IP" | awk -F. '{print $4}')
if [[ -z "$LAST_OCT" ]]; then
  echo "Cannot parse host IP: $HOST_IP" >&2; exit 1
fi
if [[ "${MESH_IP:-}" == "auto" || -z "${MESH_IP:-}" ]]; then
  MESH_IP="10.10.0.${LAST_OCT}"
fi
MESH_PREFIX="${MESH_IP%.*}"
NAME=${NAME:-$(hostname -s | sed 's/[^A-Za-z0-9]/_/g')}
if [[ -z "${PUB_ADDR:-}" ]]; then
  PUB_ADDR="$(hostname -I | awk -v prefix="${MESH_PREFIX}." '{for(i=1;i<=NF;i++) if($i !~ "^"prefix){print $i; exit}}')"
fi
PUB_ADDR=${PUB_ADDR:-$HOST_IP}
SERVER_ADDR=${SERVER_ADDR:?SERVER_ADDR required}
MESH_TOKEN=${MESH_TOKEN:?MESH_TOKEN required}
MESH_UUID=${MESH_UUID:-$(uuidgen)}
VLESS_PORT=${VLESS_PORT:-443}
TINC_PORT=${TINC_PORT:-6060}
FW_BASE=${FW_BASE:-7000}
REG_PORT=${REG_PORT:-9000}
REALITY_DEST=${REALITY_DEST:-www.microsoft.com:443}
RELAY_SERVER=${RELAY_SERVER:-1}
RELAY_PORT=${RELAY_PORT:-4443}
ARGS=(--server-addr "$SERVER_ADDR" --mesh-ip "$MESH_IP" --token "$MESH_TOKEN" --name "$NAME" --pub-addr "$PUB_ADDR" --mesh-uuid "$MESH_UUID" --vless-port "$VLESS_PORT" --tinc-port "$TINC_PORT" --fw-base "$FW_BASE" --registry-port "$REG_PORT" --reality-dest "$REALITY_DEST" --relay-port "$RELAY_PORT" --deploy k8s)
if [[ "${MESH_DIAL_ONLY:-0}" = "1" ]]; then
  ARGS+=(--dial-only)
fi
if [[ "${RELAY_SERVER}" = "0" ]]; then
  ARGS+=(--no-relay-server)
else
  ARGS+=(--relay-server)
fi
exec /usr/local/bin/setup-client "${ARGS[@]}"
