# proton-vpn-cli

Unofficial Proton VPN command-line client for **macOS** and **Windows**.

Authenticates with Proton’s VPN API, creates a WireGuard certificate, and connects through the **system WireGuard tools**. Includes an interactive TUI.

> **Not an official Proton product.** For the supported apps, use [Proton VPN](https://protonvpn.com/download). Proton’s official CLI is [Linux-only](https://protonvpn.com/support/linux-cli).

## Install

Requires [Bun](https://bun.sh) ≥ 1.1.

```bash
bun install -g github:brandonkramer/proton-vpn-cli
```

Then:

```bash
protonvpn          # interactive TUI
protonvpn --help
```

### From a clone

```bash
git clone https://github.com/brandonkramer/proton-vpn-cli.git
cd proton-vpn-cli
bun install
bun link           # optional: puts `protonvpn` on your PATH
```

## Requirements

- Bun ≥ 1.1
- Proton account in [Single Password Mode](https://proton.me/support/single-password)
- TOTP if you use 2FA (FIDO2/security keys are not supported)
- WireGuard:
  - **macOS:** `brew install wireguard-tools` (sudo for connect/disconnect)
  - **Windows:** [WireGuard for Windows](https://www.wireguard.com/install/) (Administrator terminal for connect/disconnect)

Close the Proton VPN desktop app before connecting so tunnels do not conflict.

On macOS, connect/disconnect may ask for your **Mac login password** (sudo), not your Proton password.

## Usage

### Interactive TUI

```bash
protonvpn
# or
protonvpn tui
```

↑↓ + enter to choose · `q` / Esc to quit.

### Commands

```bash
protonvpn signin [username]
protonvpn signout
protonvpn countries
protonvpn servers --country US
protonvpn connect --country US
protonvpn connect --city "New York"
protonvpn connect US#23
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

## How it works

1. SRP login to `https://vpn-api.proton.me` (session cached in your OS config dir)
2. Pick a server (lowest Proton `Score`, then `Load`)
3. Create an Ed25519 → X25519 WireGuard certificate
4. Write a local `.conf` under `~/.config/proton-vpn-cli/` (macOS/Linux) or `%APPDATA%\proton-vpn-cli\` (Windows)
5. Bring the tunnel up with `wg-quick` or `wireguard.exe`

Session tokens and WireGuard configs stay on your machine in those config dirs — they are **not** part of this repository.

## Development

```bash
bun install
bun run typecheck
bun test
bun run src/index.ts --help
```

## Publishing / releasing

Users install from GitHub with Bun (recommended):

```bash
bun install -g github:brandonkramer/proton-vpn-cli
# pin a release:
bun install -g github:brandonkramer/proton-vpn-cli#v0.1.0
```

### Cut a new version (maintainers)

**Option A — GitHub Actions UI (recommended)**  
1. Open [Actions → Release](https://github.com/brandonkramer/proton-vpn-cli/actions/workflows/release.yml)  
2. **Run workflow**  
3. Enter version (e.g. `0.2.0`)  
4. The workflow bumps `package.json`, pushes `v0.2.0`, runs checks, and creates the GitHub Release  

**Option B — git tag**  
```bash
# bump "version" in package.json first, commit, then:
git tag v0.2.0
git push origin v0.2.0
```

CI runs on every push/PR to `main`. Optional later: publish to npm (`npm publish`).

## License

[GPL-3.0-or-later](LICENSE) (required by `@protontech/crypto`).
