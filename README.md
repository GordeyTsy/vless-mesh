# VLESS Mesh (tinc over Reality)

A reproducible L2 mesh VPN where **tinc** carries Ethernet frames and the transport is **VLESS + Reality** (Xray). All nodes can talk **peer‑to‑peer**; if direct P2P is impossible, traffic can still relay via any reachable peer.

Tested with Ubuntu 24.04 LXD containers, but the scripts are distro‑agnostic for Debian/Ubuntu–like systems.

## Components
- **tinc**: L2 switch mode, static /24 addressing, automatic P2P links.
- **xray-core**: VLESS over TCP + Reality; each node has its own Reality keypair/shortId; all nodes share one mesh UUID.
- **Mesh registry** (on server): simple HTTP API to distribute host files and Reality info; authenticated by a shared token.
- **mesh-refresh** (on clients): systemd timer that re-syncs peers every 2 minutes.

## What the scripts install
- Packages: `tinc`, `curl`, `jq`, `python3`, `python3-cryptography`, `xray-core` (via official installer if missing).
- Services: `tinc@mesh`, `xray.service`, `mesh-registry.service` (server), `mesh-refresh.timer` (clients).

## Network / Ports
- tinc virtual subnet: `/24` you choose (examples use 10.10.0.0/24).
- tinc TCP listen: default `6060` (local only; real transport is via xray).
- xray VLESS listen: default `443` on every node.
- Reality dest/SNI: default `www.microsoft.com:443` (change with `--reality-dest`).
- Registry HTTP: default `9000` on server.

## Quick start (clean environment)
1) **Server** (has reachable IP/DNS):
```bash
sudo ./setup-server --mesh-ip 10.10.0.1 --pub-addr <SERVER_PUBLIC_IP>
```
Output includes:
- Mesh UUID
- Reality public key + shortId
- Registry token and URL
- Host file path `/etc/tinc/mesh/hosts/server`

2) **Each client** (unique mesh IP + its public/DNS addr):
```bash
sudo ./setup-client \
  --server-addr <SERVER_PUBLIC_IP> \
  --mesh-ip 10.10.0.X \
  --pub-addr <THIS_PUBLIC_IP_OR_DNS> \
  --token <TOKEN_FROM_SERVER>
```
That single command will:
- Register the node in the registry
- Pull all peers and build per-peer VLESS outbounds and tinc host files
- Start xray, tinc, and the mesh-refresh timer

3) **Verify connectivity**
```bash
ping 10.10.0.1          # from any client to server
ping 10.10.0.4          # client-to-client (P2P over VLESS)
```

## Flags reference
### setup-server
- `--mesh-ip` (required) Mesh /24 IP of server.
- `--pub-addr` (required) Public IP/DNS reachable by clients.
- `--vless-port` (default 443)
- `--tinc-port` (default 6060)
- `--mtu` (default 1400)
- `--reality-dest` (default www.microsoft.com:443)
- `--mesh-uuid` (optional preset)
- `--registry-port` (default 9000)
- `--registry-token` (optional preset)

### setup-client
- `--server-addr` (required) Server public IP/DNS (registry + VLESS peers)
- `--mesh-ip` (required) Client mesh /24 IP
- `--token` (required) Registry token from server
- `--pub-addr` Public/DNS other peers will dial (defaults to first IP of host)
- `--name` Custom tinc node name (default: hostname)
- `--vless-port` (default 443)
- `--tinc-port` (default 6060)
- `--fw-base` Base dokodemo port (default 7000; per-peer increments)
- `--mtu` (default 1400)
- `--mesh-uuid` Override mesh UUID
- `--registry-port` (default 9000)
- `--reality-dest` Fake SNI/dest for Reality (default www.microsoft.com:443)
- `--refresh-only` Skip installs/registration; just re-pull peers and rewrite configs

## Files & state
- `/etc/vless-mesh/token` (server): registry auth token.
- `/etc/vless-mesh/peers.json`: current peer list (both server and clients).
- `/etc/vless-mesh/self.json`: client’s own Reality keys and shortId (keeps keys stable on reruns).
- `/etc/vless-mesh/config.json`: saved client parameters for refresh.
- `/etc/tinc/mesh/hosts/*`: host files rewritten to point to local dokodemo ports.
- `/usr/local/etc/xray/config.json`: generated xray config.

## Adding a new client later
Just run `setup-client` once on the new node with its mesh IP and pub addr plus the shared token. Existing nodes will pick it up automatically via their `mesh-refresh` timer (or run `setup-client --refresh-only`).

## Refreshing peers manually
On any client:
```bash
sudo ./setup-client --refresh-only
```
Uses saved `/etc/vless-mesh/config.json` and `self.json`; does not reinstall packages.

## Troubleshooting
- **Ping fails / "unknown identity" in tinc logs**: ensure `/etc/tinc/mesh/hosts/` has all peers; run `--refresh-only` or rerun `setup-client` to regenerate host files.
- **Reality auth failed**: verify server public key/shortId in `/etc/vless-mesh/peers.json` match server output; rerun client with correct `--token` and `--server-addr`.
- **Ports blocked**: VLESS uses TCP 443 by default—make sure it’s reachable; registry needs TCP 9000.
- **Re-run after IP change**: run `setup-client` again with updated `--pub-addr` or edit `config.json` then `--refresh-only`.

## Cleanup
- Stop services and remove configs:
```bash
sudo systemctl disable --now xray tinc@mesh mesh-refresh.timer mesh-registry.service 2>/dev/null
sudo rm -rf /etc/tinc/mesh /etc/vless-mesh /usr/local/etc/xray
```

## Security notes
- Reality provides TLS camouflage; each node has its own keypair/shortId.
- Registry is protected only by the shared token—treat it as a secret.
- tinc encryption remains enabled (double encryption over Reality); you can tune tinc if desired.
