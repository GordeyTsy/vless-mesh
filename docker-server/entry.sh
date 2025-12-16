#!/bin/bash
set -euo pipefail

MESH_IP="${MESH_IP:-10.10.0.1}"
PUB_ADDR="${PUB_ADDR:-}"
VLESS_PORT="${VLESS_PORT:-443}"
TINC_PORT="${TINC_PORT:-6060}"
MTU="${MTU:-1400}"
REALITY_DEST="${REALITY_DEST:-www.microsoft.com:443}"
REG_PORT="${REG_PORT:-9000}"

if [[ -z "${PUB_ADDR}" ]]; then
  echo "PUB_ADDR is required" >&2
  exit 1
fi

exec /usr/local/bin/setup-server \
  --mesh-ip "${MESH_IP}" \
  --pub-addr "${PUB_ADDR}" \
  --vless-port "${VLESS_PORT}" \
  --tinc-port "${TINC_PORT}" \
  --mtu "${MTU}" \
  --reality-dest "${REALITY_DEST}" \
  --registry-port "${REG_PORT}" \
  --deploy container

