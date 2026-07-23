/**
 * Best-effort WireGuard install during package postinstall.
 * Never fails the overall install — WireGuard may need Admin/Homebrew.
 */
import {
  ensureWireGuardInstalled,
  formatSetupResult,
} from "../src/setup/wireguard.ts";

const result = await ensureWireGuardInstalled();
console.log(`proton-vpn-cli: ${formatSetupResult(result)}`);

if (result.status === "failed") {
  console.log(
    "proton-vpn-cli: You can retry later with: protonvpn setup",
  );
}

process.exit(0);
