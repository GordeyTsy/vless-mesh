#!/bin/bash
set -euo pipefail
# Expect env: SERVER_ADDR, MESH_TOKEN, MESH_UUID, VLESS_PORT, TINC_PORT, FW_BASE, REG_PORT, REALITY_DEST, MESH_DIAL_ONLY
# Derive mesh IP from hostIP: 10.10.0.<last_octet>
HOST_IP=$(hostname -I | awk '{print $1}')
LAST_OCT=$(echo "$HOST_IP" | awk -F. '{print $4}')
if [[ -z "$LAST_OCT" ]]; then
  echo "Cannot parse host IP: $HOST_IP" >&2; exit 1
fi
MESH_IP="10.10.0.${LAST_OCT}"
NAME=${NAME:-$(hostname -s | sed 's/[^A-Za-z0-9]/_/g')}
PUB_ADDR=${PUB_ADDR:-$HOST_IP}
SERVER_ADDR=${SERVER_ADDR:?SERVER_ADDR required}
MESH_TOKEN=${MESH_TOKEN:?MESH_TOKEN required}
MESH_UUID=${MESH_UUID:-$(uuidgen)}
VLESS_PORT=${VLESS_PORT:-443}
TINC_PORT=${TINC_PORT:-6060}
FW_BASE=${FW_BASE:-7000}
REG_PORT=${REG_PORT:-9000}
REALITY_DEST=${REALITY_DEST:-www.microsoft.com:443}
ARGS=(--server-addr "$SERVER_ADDR" --mesh-ip "$MESH_IP" --token "$MESH_TOKEN" --name "$NAME" --pub-addr "$PUB_ADDR" --mesh-uuid "$MESH_UUID" --vless-port "$VLESS_PORT" --tinc-port "$TINC_PORT" --fw-base "$FW_BASE" --registry-port "$REG_PORT" --reality-dest "$REALITY_DEST" --deploy k8s)
if [[ "${MESH_DIAL_ONLY:-0}" = "1" ]]; then
  ARGS+=(--dial-only)
fi
exec /usr/local/bin/setup-client "${ARGS[@]}"
