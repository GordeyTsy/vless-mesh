# VLESS Mesh (tinc over Reality)

A reproducible L2 mesh where **tinc** carries Ethernet frames and the transport is **VLESS + Reality** (Xray). Supports P2P between all nodes, NAT-friendly dial-only clients, auto peer selection by iperf3, and LAN-aware direct tinc paths.

Tested on Ubuntu 24.04 (LXD), but scripts target Debian/Ubuntu-like systems.

## What you get
- L2 mesh (switch mode) with static /24 addressing.
- Encrypted transport: VLESS over TCP + Reality on every node.
- NAT clients: dial-only mode (outbound only) with automatic best-peer choice via iperf3.
- LAN-aware: peers in the same private /24 connect directly via tinc (no VLESS overhead).
- Mesh registry on server to distribute host files & Reality params (token-protected).
- Auto-refresh timer on clients.
- Optional kubelet node IP rewiring to mesh IP when running on Kubernetes nodes.

## Dependencies installed by scripts
- Packages: `tinc`, `curl`, `jq`, `python3`, `python3-cryptography`, `iperf3`, `ipset`, `iptables`, `xray-core` (if missing, installed via official script).
- Services: `tinc@mesh`, `xray.service`, `mesh-registry.service` (server), `mesh-refresh.timer` (clients), `iperf3-mesh.service` (accepting nodes).

## Ports & network
- Virtual subnet: you choose `/24` (example 10.10.0.0/24).
- tinc TCP listen: default `6060` (local only when VLESS is used).
- xray VLESS listen: default `443` on every node.
- Reality dest/SNI: default `www.microsoft.com:443` (change with `--reality-dest`).
- Registry HTTP: default `9000` on server.
- iperf3: `5201` TCP (used only for throughput probing).

## Quick start (clean environment)
1) **Server** (reachable IP/DNS):
```bash
sudo ./setup-server --mesh-ip 10.10.0.1 --pub-addr <SERVER_PUBLIC_IP>
# or auto mesh IP (10.10.0.<last_octet_of_host_ip>):
sudo ./setup-server --pub-addr <SERVER_PUBLIC_IP>
```
Output: Mesh UUID, Reality public key/shortId, registry token, host file `/etc/tinc/mesh/hosts/server`.

2) **Clients** (unique mesh IP + public/DNS):
Standard (accepts inbound):
```bash
sudo ./setup-client \
  --server-addr <SERVER_PUBLIC_IP> \
  --pub-addr <THIS_PUBLIC_OR_DNS> \
  --token <TOKEN>
```
Tip: if the registry port is blocked or the server is not directly reachable, you can point `--server-addr` to any existing mesh node; non-peer traffic to `:443` is relayed to the server by default, and `setup-client` will fall back to port `443` when `9000` is unavailable.
NAT dial-only (outbound only) with best-peer selection (top 2):
```bash
sudo ./setup-client \
  --server-addr <SERVER_PUBLIC_IP> \
  --pub-addr <THIS_LAN_IP_OR_PUBLIC> \
  --token <TOKEN> \
  --dial-only --top-peers 2
```
`--mesh-ip` can be omitted or set to `auto` to derive `10.10.0.<last_octet>` from the host IP.
Peers in same private /24 automatically use direct tinc TCP (no VLESS) for lower latency.

3) **Verify**
```bash
ping 10.10.0.1      # client -> server
ping 10.10.0.4      # client -> client (p2p)
```
`ss -tnp | grep 443` on a client should show direct sockets to peers; for LAN peers you should see tinc TCP to their LAN IP/6060.

## Flags reference
### setup-server
- `--mesh-ip` server mesh /24 IP (default auto from host IP; supports `auto`)
- `--pub-addr` (required) public/DNS reachable by clients
- `--vless-port` (443), `--tinc-port` (6060), `--mtu` (1400)
- `--reality-dest` (default www.microsoft.com:443)
- `--mesh-uuid` (optional), `--registry-port` (9000), `--registry-token` (optional)
- `--deploy` host|compose|k8s (default host). `compose` builds/starts a privileged container stack via docker compose; `k8s` writes `mesh-server.yaml` with hostNetwork+hostPath and applies it.
- `--image-registry REG/` optional image prefix for compose/k8s (e.g. `registry:443/`).
- `--k8s-clients` / `--no-k8s-clients` toggle mesh client DaemonSet install (auto when kubectl is present).
- `--no-kubelet-node-ip` skip setting kubelet `--node-ip` to the mesh IP.

### setup-client
- `--server-addr` (required) server public IP/DNS
- `--mesh-ip` static mesh /24 IP (default auto from host IP; supports `auto`)
- `--token` (required) registry token
- `--pub-addr` public/DNS for this node (defaults to first IP)
- `--name` tinc node name (default hostname)
- `--vless-port` (443), `--tinc-port` (6060), `--fw-base` (7000), `--mtu` (1400)
- `--mesh-uuid`, `--registry-port`, `--reality-dest`
- `--dial-only` outbound-only; does not accept inbound VLESS
- `--top-peers N` keep N best peers by iperf3 (default 2) in dial-only mode
- `--relay-server` / `--no-relay-server` toggle relaying non-peer `:443` traffic to the server (default on)
- `--relay-port` local relay listen port (default 4443)
- `--refresh-only` reuse saved config, re-pull registry, rerun iperf selection
- `--deploy` host|docker|compose|k8s (default host). Docker/compose run a privileged container with host network + /dev/net/tun mounted; configs still live under `/etc/tinc/mesh` and `/usr/local/etc/xray`.
- `--no-kubelet-node-ip` skip setting kubelet `--node-ip` to the mesh IP (host deploy only).

## Files
- Server token: `/etc/vless-mesh/token`
- Peers list: `/etc/vless-mesh/peers.json`
- Client identity: `/etc/vless-mesh/self.json`
- Saved params: `/etc/vless-mesh/config.json`
- tinc hosts: `/etc/tinc/mesh/hosts/*`
- xray config: `/usr/local/etc/xray/config.json`

## How dial-only selection works
- After registration, NAT client runs iperf3 to all accepting peers’ public addresses on port 5201.
- Keeps top N by throughput (`--top-peers`).
- Builds VLESS+tinc only to those; others are ignored.
- On LAN (same private /24), connection bypasses VLESS: tinc points directly to peer LAN IP/6060.

## Refresh
```
sudo ./setup-client --refresh-only
```
Uses saved config/self, re-fetches registry, reruns iperf (for dial-only), rebuilds xray/tinc, restarts services.

## Adding a new client later
Run `setup-client` once on the new node with its mesh IP (or `auto`), pub-addr, token. Existing nodes will learn it on next refresh (timer every 2 minutes).

## Kubernetes auto clients
When `setup-server` runs on a control-plane with `kubectl`, it also creates the `vless-mesh` namespace, `mesh-client` secret/configmap, and applies a DaemonSet to all non-control-plane nodes. It also updates kubelet `--node-ip` to the mesh IP by default (use `--no-kubelet-node-ip` to skip). Set `--image-registry registry:443/` to point the DaemonSet at your in-cluster registry.

## Troubleshooting
- No ping / “unknown identity”: run `--refresh-only` to regenerate hosts; ensure token/mesh UUID correct.
- Reality auth failed: confirm server public key/shortId in `/etc/vless-mesh/peers.json`.
- Ports: VLESS 443, registry 9000, iperf3 5201; allow outbound 443 from NAT nodes.
- Changed public/LAN IP: rerun `setup-client` with updated `--pub-addr` or edit config.json then `--refresh-only`.

## Security notes
- Reality provides TLS camouflage; each node has its own keypair/shortId; mesh UUID is shared.
- Registry protected by token; keep it secret.
- tinc encryption remains enabled (double encryption over Reality for non-LAN paths).

## Backend API (Django)
- Purpose: serve mesh status, stats, and topology to the neon UI (`web/index.html`).
- Run locally:
  ```bash
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
  .venv/bin/python backend/manage.py migrate   # first run; uses SQLite
  .venv/bin/python backend/manage.py runserver 0.0.0.0:8001
  ```
 - Docker Compose (PostgreSQL + Django):
   ```bash
   docker compose up --build
   # API on http://127.0.0.1:8001, DB persisted in pgdata volume
   ```
- Configure DB: by default SQLite; set `DATABASE_URL=postgres://user:pass@host:5432/db` to use Postgres (Compose sets this automatically).
- Endpoints (GET):
  - `/api/status` — mesh health, registry/reality/service flags.
  - `/api/stats` — peers, iperf, RTT, MTU.
  - `/api/nodes` — node coordinates + links for the canvas.
- CORS is permissive (`*`) so the static UI (served from file:// or another port) can call the API. Set `API_BASE` in `web/main.js` if you host elsewhere.

## Compose / k8s deployment (mesh services)
- Server compose: `./setup-server --deploy compose --mesh-ip 10.10.0.1 --pub-addr 1.2.3.4 --image-registry registry:443/` builds/pushes `vless-mesh-node:latest`, writes `/etc/vless-mesh/docker-compose.mesh.yml`, and runs `docker compose up -d` with host network + /dev/net/tun mounted.
- Server k8s: `./setup-server --deploy k8s ...` writes `/etc/vless-mesh/mesh-server.yaml` (hostNetwork, hostPath volumes) and `kubectl apply -f` it; ensure the image is reachable (set `--image-registry` and push or pre-load).
- Client docker: `./setup-client --deploy docker ...` generates configs under `/etc/{tinc,vless-mesh}` and launches `docker run --network host --cap-add NET_ADMIN --device /dev/net/tun vless-mesh-node:latest`.
- Client compose: `./setup-client --deploy compose ...` writes `/etc/vless-mesh/docker-compose.client.yml` and runs it.
- Default (host) behavior unchanged.
