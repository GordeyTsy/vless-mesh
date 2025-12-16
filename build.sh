#!/usr/bin/env bash
set -euo pipefail

# Build + push vless-mesh images into the in-cluster registry.

unset HTTPS_PROXY https_proxy HTTP_PROXY http_proxy ALL_PROXY all_proxy

REGISTRY="${REGISTRY:-registry:443}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

build_and_push() {
  local name="$1" context="$2" dockerfile="$3"
  local local_tag="${name}:latest"
  local remote_tag="${REGISTRY}/${name}:latest"

  docker build -t "${local_tag}" -f "${dockerfile}" "${context}"
  docker tag "${local_tag}" "${remote_tag}"
  docker push "${remote_tag}"
}

build_and_push "vless-mesh-backend" "." "backend/Dockerfile"
build_and_push "vless-mesh-web" "web" "web/Dockerfile"
build_and_push "vless-mesh-node" "." "docker-node/Dockerfile"
build_and_push "vless-mesh-server" "." "docker-server/Dockerfile"
