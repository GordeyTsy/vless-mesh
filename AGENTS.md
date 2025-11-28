# Repository Guidelines

## Project Structure
- Root scripts: `setup-server`, `setup-client` — main automation for tinc + VLESS Reality mesh.
- Docs: `README.md`, `README.ru.md`, contributor guide `AGENTS.md`.
- Runtime state (on target hosts): `/etc/tinc/mesh`, `/etc/vless-mesh`, `/usr/local/etc/xray` (created by scripts, not in repo).

## Build, Test, Run
- No build step required; scripts are bash.
- Local shellcheck (optional): `shellcheck setup-server setup-client`.
- Quick dry-run sanity: open files to verify config blocks, e.g. `grep -n "tinc.conf" setup-client`.
- Live test (LXD): push scripts with `lxc file push setup-* <container>/usr/local/bin/` then execute `setup-server ...` / `setup-client ...`.

## Coding Style
- Bash POSIX-ish with `set -euo pipefail`.
- Indent with 2 spaces for heredocs content where practical; otherwise keep existing alignment.
- Prefer long-form flags (`--mesh-ip`) and explicit variable names; avoid one-letter temps except loop indices.
- Keep comments minimal and functional; no trailing whitespace.

## Naming Conventions
- Mesh network name is fixed to `mesh`; tinc interface `mesh0`.
- Hostnames converted to safe node names: alphanumeric/underscore.
- Files: keep scripts lowercase with hyphens (`setup-client`).

## Testing Guidelines
- Functional verification is manual via LXD: 
  - Bring up server + clients, ensure `ping` across mesh and `ss -tnp` shows VLESS links.
  - For dial-only paths, confirm iperf3 runs and top peers are chosen.
- No automated test suite; if adding one, place under `tests/` and document run command.

## Commit & PR Guidelines
- Commit messages: short imperative, e.g., “Add iperf-based peer selection”.
- Scope one logical change per commit (scripts/doc updates separated when reasonable).
- PRs should include:
  - Summary of behavior change and rationale.
  - Test notes (e.g., LXD run, ping/iperf results).
  - Any config defaults altered (ports, tokens, MTU).

## Security & Configuration Tips
- Treat registry token and Reality keys as secrets; never commit runtime files from `/etc/vless-mesh` or `/usr/local/etc/xray`.
- Default ports: VLESS 443, registry 9000, iperf3 5201 — expose only as needed.
- For LAN-only labs, you may disable Reality dest override; for WAN, keep defaults for camouflage.
