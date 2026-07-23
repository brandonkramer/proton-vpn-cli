import { homedir } from "node:os";
import { join } from "node:path";
import { TUNNEL_INTERFACE } from "../proton/constants.ts";

export function configDir(): string {
  if (process.platform === "win32") {
    const base = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(base, "proton-vpn-cli");
  }

  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "proton-vpn-cli");
  return join(homedir(), ".config", "proton-vpn-cli");
}

export function sessionPath(): string {
  return join(configDir(), "session.json");
}

export function tunnelMetaPath(): string {
  return join(configDir(), "active-tunnel.json");
}

export function wireguardConfPath(): string {
  return join(configDir(), `${TUNNEL_INTERFACE}.conf`);
}
