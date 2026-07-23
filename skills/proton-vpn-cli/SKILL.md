---
name: proton-vpn-cli
description: >-
  Use the unofficial Proton VPN CLI (protonvpn) on macOS/Windows: install,
  sign in (interactive or Proton Pass), browse/filter countries and servers,
  connect/disconnect WireGuard, and check status. Use when the user wants to
  run protonvpn, connect to Proton VPN from the terminal, or set up Pass-based
  sign-in.
---

# protonvpn (user guide)

Unofficial Proton VPN CLI for **macOS** and **Windows**. Not an official Proton product.

Requires **Bun** ≥ 1.1 at runtime (even if installed via npm).

## Install

```bash
bun add -g proton-vpn-cli
# or
npm install -g proton-vpn-cli
```

From a clone:

```bash
bun install
bun link   # optional: puts protonvpn on PATH
```

Also needs system WireGuard tools. The CLI can install them (`protonvpn setup`), or:

- **macOS:** Homebrew `wireguard-tools` (sudo for connect/disconnect)
- **Windows:** WireGuard app via winget (Administrator terminal for connect/disconnect)

Close the Proton VPN desktop app before connecting so tunnels do not conflict.

## Quick start

```bash
protonvpn                 # interactive TUI
protonvpn signin
protonvpn connect --country US
protonvpn status
protonvpn disconnect
```

Account must be in [Single Password Mode](https://proton.me/support/single-password). TOTP 2FA is supported; FIDO2/security keys are not.

On macOS, connect/disconnect may ask for your **Mac login password** (sudo), not your Proton password.

## Interactive TUI

```bash
protonvpn
# or
protonvpn tui
```

- ↑↓ + Enter to choose
- In country/server lists: **type to filter** (e.g. `us`, `united`, city name)
- Backspace edits the filter; **Esc** clears filter, Esc again goes back
- `q` quits from the home screen

## Sign in

### Interactive

```bash
protonvpn signin
protonvpn signin myusername
```

Session is cached in the OS config dir so you rarely re-enter the password.

### Optional: Proton Pass CLI

If [pass-cli](https://protonpass.github.io/pass-cli/) is installed and logged in:

```bash
pass-cli login   # once, if needed
protonvpn signin --pass "pass://Personal/Proton"
```

Or:

```bash
export PROTONVPN_PASS="pass://Personal/Proton"
protonvpn signin
```

- `Vault/Item` works without the `pass://` prefix
- Reads username/email, password, and TOTP (when present) from the login item
- A username argument still overrides the Pass username
- Without `--pass` / `PROTONVPN_PASS`, prompts are used as usual

```bash
protonvpn signout   # clear cached session (+ stored WireGuard credentials)
```

## Connect / disconnect

```bash
protonvpn countries
protonvpn servers --country US
protonvpn connect --country US
protonvpn connect --city "New York"
protonvpn connect US#23
protonvpn connect --p2p
protonvpn connect --securecore
protonvpn connect --tor
protonvpn connect --free-only
protonvpn status
protonvpn disconnect
```

| Flag | Meaning |
|------|---------|
| `--country <code>` | Exit country (e.g. `NL`) |
| `--city <name>` | City name |
| `--p2p` | P2P servers |
| `--securecore` | Secure Core |
| `--tor` | Tor over VPN |
| `--free-only` | Free-tier only |

Country availability depends on your Proton plan.

## Setup / troubleshooting

```bash
protonvpn setup          # install WireGuard tools if missing
protonvpn --help
protonvpn signin --help
```

**`Cannot find module 'openpgp/lightweight'`** after a global install: reinstall/upgrade to a current `proton-vpn-cli` (postinstall patches OpenPGP for Bun/Node). Or run from a local clone with `bun install`.

**CAPTCHA / human verification:** sign in once at https://account.protonvpn.com from this network, then retry.

**Config location** (sessions, caches, WireGuard conf — local only):

- macOS/Linux: `~/.config/proton-vpn-cli/` (or `$XDG_CONFIG_HOME/proton-vpn-cli`)
- Windows: `%APPDATA%\proton-vpn-cli\`

## Agent rules when helping a user

1. Prefer the commands above; do not invent official Proton CLI flags (that tool is Linux-only and different).
2. Never print passwords, Pass-resolved secrets, session tokens, or WireGuard private keys.
3. If Pass is requested, check `pass-cli info` / ask the user to `pass-cli login` — do not invent credentials.
4. For connect/disconnect failures, distinguish **macOS/Windows admin (sudo)** password from **Proton** password.
