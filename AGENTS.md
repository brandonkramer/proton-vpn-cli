# AGENTS.md

Guidance for AI agents working in this repository.

End-user skill (how to run `protonvpn`): [skills/proton-vpn-cli/SKILL.md](skills/proton-vpn-cli/SKILL.md). This file (`AGENTS.md`) is for repo development.

## Project

Unofficial **Proton VPN CLI** (`protonvpn`) for **macOS** and **Windows**.

- Runtime: **Bun** ≥ 1.1 (shebang `#!/usr/bin/env bun`)
- UI: Ink + React + `@inkjs/ui` (interactive TUI when run with no args)
- Auth: Proton SRP via `@protontech/crypto`
- Tunnel: system WireGuard (`wg-quick` / `wireguard.exe`)
- License: **GPL-3.0-or-later** (required by `@protontech/crypto`)

Not an official Proton product.

## Layout

| Path | Role |
|------|------|
| `src/index.ts` | CLI entry; no args → TUI |
| `src/commands/` | Commander subcommands |
| `src/tui/` | Interactive home / pickers / sign-in flow |
| `src/proton/` | API client, auth, servers, HTTP |
| `src/pass/` | Optional Proton Pass CLI credential resolver |
| `src/wireguard/` | Keys, config render, bring up/down |
| `src/config/` | Session / cache / credential paths under OS config dir |
| `src/ui/` | Shared Ink components (brand, prompts, filterable select) |
| `scripts/` | `postinstall`: openpgp patch + WireGuard ensure |
| `tests/` | `bun:test` unit tests |
| `.github/workflows/` | `ci.yml`, `release.yml` |

User data lives outside the repo:

- macOS/Linux: `~/.config/proton-vpn-cli/` (or `$XDG_CONFIG_HOME`)
- Windows: `%APPDATA%\proton-vpn-cli\`

Files include `session.json`, `logicals-cache.json`, `wireguard-credentials.json`, active tunnel meta, and the WireGuard `.conf` (mode `0600` where possible).

## Commands agents should use

```bash
bun install
bun run typecheck    # tsc --noEmit
bun test
bun run src/index.ts --help
```

Package manager: **Bun only** (not npm/yarn/pnpm for installs in this repo).

Do **not** run long-lived `bun run start` / TUI unless the user asks — assume interactive use is local.

## Release process

Releases are cut via GitHub Actions:

```bash
gh workflow run Release -f version=X.Y.Z
```

The workflow bumps `package.json`, tags `vX.Y.Z`, creates the GitHub Release, and publishes to npm (Trusted Publisher / OIDC).

- Keep [CHANGELOG.md](CHANGELOG.md) updated (Keep a Changelog).
- Prefer promoting `[Unreleased]` → `[X.Y.Z]` in the same change set as the feature.
- Do not push tags by hand unless asked; prefer the Release workflow.

## Important implementation notes

### OpenPGP postinstall patch

`@protontech/openpgp` only exports `openpgp/lightweight` under the `browser` condition. [scripts/patch-openpgp.ts](scripts/patch-openpgp.ts) adds Node/`import` resolution. It must walk up for **hoisted** `node_modules` (Bun/npm global installs).

### API caching

- Logicals (`/vpn/v1/logicals`): 10m memory + disk TTL, `ETag` / `If-None-Match` / `304`, stale fallback on network failure.
- Session verify: lightweight `GET /vpn` (not a full logicals fetch).
- WireGuard keypair reuse until Proton `RefreshTime`; cleared on sign-out / session clear.

### Optional Proton Pass sign-in

```bash
protonvpn signin --pass "pass://Vault/Item"
# or PROTONVPN_PASS
```

Uses `pass-cli` when present; interactive prompts remain the default. Never log resolved secrets.

### Interactive filtering

Country/server browsers use [src/ui/filterable-select.tsx](src/ui/filterable-select.tsx). Matching covers ISO code, English name (`Intl.DisplayNames`), and cities. Esc clears filter, then goes back.

## Testing conventions

- Prefer dependency injection over `mock.module` for `protonFetch` / HTTP — Bun’s `mock.module` can leak across files (CI Linux file order differs from macOS).
- For `protonFetch` unit tests, pass `fetchImpl` in options.
- Config-path tests should set a temp `XDG_CONFIG_HOME` and clean up.

## Code style

- Keep changes focused; match existing patterns (Commander commands, Ink screens, `CliError`).
- Do not commit secrets, session files, or injected Pass material.
- Do not force-push `main` or skip hooks unless the user explicitly asks.

## Quick mental model

1. Sign in (SRP + optional TOTP) → cache session  
2. Fetch/cached logicals → pick server  
3. Ensure WireGuard credentials (reuse or certificate API)  
4. Write conf → `wg-quick` / WireGuard.exe up  
5. Status / disconnect via saved tunnel meta
