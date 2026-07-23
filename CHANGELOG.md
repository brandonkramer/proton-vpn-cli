# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-07-23

### Added
- `protonvpn update` / `update --check` to upgrade the global CLI via bun or npm

## [0.3.0] - 2026-07-23

### Added
- Agent-friendly scripting: global `--json`, `-y/--yes`, `--sudo`
- Stable JSON payloads (`version: 1`) for status/countries/servers/connect/disconnect/signin/signout/setup
- Exit codes: `0` ok, `1` error, `2` usage, `3` not signed in, `4` privilege needed
- Non-interactive sudo via `sudo -n` first (interactive only with `--sudo` or a human TTY)

### Changed
- No-args `protonvpn` opens the TUI only on an interactive TTY; otherwise prints usage (exit 2)
- Quiet/JSON/CI modes skip Ink spinners and timed error screens (plain stderr / JSON errors)

## [0.2.3] - 2026-07-23

### Added
- Type-to-filter in interactive country and server browsers (matches code, name, city)

## [0.2.2] - 2026-07-23

### Added
- Disk and in-memory TTL cache for `/vpn/v1/logicals` (10 minutes), with stale fallback when the network fails
- HTTP `ETag` / `If-None-Match` / `304` support in the Proton API client
- WireGuard keypair and certificate reuse until Proton’s `RefreshTime` (cleared on sign-out)
- Optional Proton Pass CLI sign-in: `protonvpn signin --pass pass://Vault/Item` or `PROTONVPN_PASS` (username, password, TOTP)
- `CHANGELOG.md`

### Changed
- Session verification now uses lightweight `GET /vpn` instead of fetching the full server list

## [0.2.1] - 2026-07-23

### Fixed
- OpenPGP postinstall patch now finds hoisted `openpgp` under Bun/npm global installs, so `openpgp/lightweight` resolves correctly
- Release workflow publishes to npm after prepare (Trusted Publisher / OIDC)

## [0.2.0] - 2026-07-23

### Added
- Automatic WireGuard tools install when missing (`protonvpn setup`, Homebrew / winget)
- npm package publish via GitHub Actions (Trusted Publisher)
- CI and Release workflows

### Changed
- README install docs split into clear Bun and npm sections

## [0.1.0] - 2026-07-23

### Added
- Initial public release of the unofficial Proton VPN CLI for macOS and Windows
- Interactive TUI (`protonvpn` with no args)
- Sign in / sign out, list countries and servers, connect / disconnect / status
- WireGuard connections via system tools

[Unreleased]: https://github.com/brandonkramer/proton-vpn-cli/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/brandonkramer/proton-vpn-cli/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/brandonkramer/proton-vpn-cli/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/brandonkramer/proton-vpn-cli/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/brandonkramer/proton-vpn-cli/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/brandonkramer/proton-vpn-cli/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/brandonkramer/proton-vpn-cli/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/brandonkramer/proton-vpn-cli/releases/tag/v0.1.0
