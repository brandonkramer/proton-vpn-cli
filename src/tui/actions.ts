import {
  clearActiveTunnel,
  loadActiveTunnel,
  saveActiveTunnel,
} from "../config/store.ts";
import { wireguardConfPath } from "../config/paths.ts";
import { requireSession, tryExistingSession } from "../proton/auth.ts";
import { fetchLogicalServers, prepareConnection } from "../proton/client.ts";
import { TUNNEL_INTERFACE } from "../proton/constants.ts";
import {
  listCountries,
  type ServerFilter,
} from "../proton/servers.ts";
import {
  FEATURE_P2P,
  FEATURE_SECURE_CORE,
  FEATURE_TOR,
  STATUS_ONLINE,
  type LogicalServer,
} from "../proton/types.ts";
import { showMessage } from "../ui/message.tsx";
import { countryName } from "../util/countries.ts";
import { formatConnectedSummary } from "../util/summary.ts";
import { bringDown, bringUp, tunnelStatus } from "../wireguard/manager.ts";

export async function loadHomeSnapshot(): Promise<{
  signedIn: boolean;
  username: string | null;
  tunnelUp: boolean;
  serverName: string | null;
  location: string | null;
}> {
  const session = await tryExistingSession();
  const active = await loadActiveTunnel();
  const confPath = active?.confPath ?? wireguardConfPath();
  const status = await tunnelStatus(confPath);

  return {
    signedIn: Boolean(session),
    username: session?.username ?? null,
    tunnelUp: status.up,
    serverName: active?.serverName ?? null,
    location: active
      ? `${active.country}${active.city ? `, ${active.city}` : ""}`
      : null,
  };
}

export async function loadCountryOptions(): Promise<
  Array<{ label: string; value: string; searchText: string }>
> {
  const { session } = await requireSession();
  const servers = await fetchLogicalServers(session);
  return listCountries(servers).map((country) => {
    const name = countryName(country.code);
    const cityPreview = country.cities.slice(0, 3).join(", ");
    const more = country.cities.length > 3 ? "…" : "";
    return {
      value: country.code,
      label: `${country.code.padEnd(4)}${name.padEnd(22)} ${String(country.count).padStart(3)} · ${cityPreview}${more}`,
      searchText: `${country.code} ${name} ${country.cities.join(" ")}`,
    };
  });
}

export async function loadServerOptions(filter: {
  country?: string;
  p2p?: boolean;
  secureCore?: boolean;
  tor?: boolean;
  freeOnly?: boolean;
}): Promise<
  Array<{
    label: string;
    value: string;
    searchText: string;
    server: LogicalServer;
  }>
> {
  const { session } = await requireSession();
  const servers = await fetchLogicalServers(session);
  const country = filter.country?.toUpperCase();

  return servers
    .filter((server) => {
      if (server.Status !== STATUS_ONLINE) return false;
      if (country && server.ExitCountry.toUpperCase() !== country) return false;
      if (filter.freeOnly && server.Tier !== 0) return false;
      if (filter.secureCore && (server.Features & FEATURE_SECURE_CORE) === 0) {
        return false;
      }
      if (filter.p2p && (server.Features & FEATURE_P2P) === 0) return false;
      if (filter.tor && (server.Features & FEATURE_TOR) === 0) return false;
      return true;
    })
    .sort((a, b) => a.Score - b.Score || a.Load - b.Load)
    .slice(0, 80)
    .map((server) => {
      const name = countryName(server.ExitCountry);
      return {
        server,
        value: server.Name,
        label: `${server.Name.padEnd(14)} ${server.ExitCountry} ${(server.City || "-").slice(0, 14).padEnd(14)} ${String(server.Load).padStart(3)}%`,
        searchText: `${server.Name} ${server.ExitCountry} ${name} ${server.City ?? ""}`,
      };
    });
}

export async function connectWithFilter(filter: ServerFilter): Promise<void> {
  const { username, session } = await requireSession();
  const existing = await loadActiveTunnel();
  if (existing) {
    try {
      await bringDown(existing.confPath);
    } catch {
      // continue
    }
    await clearActiveTunnel();
  }

  console.log("Selecting server and creating WireGuard certificate...");
  const { server, physical, confPath } = await prepareConnection(
    session,
    username,
    filter,
  );

  console.log(
    `Connecting to ${server.Name} (${server.ExitCountry}${server.City ? `, ${server.City}` : ""})...`,
  );
  await bringUp(confPath);

  await saveActiveTunnel({
    interfaceName: TUNNEL_INTERFACE,
    confPath,
    serverName: server.Name,
    country: server.ExitCountry,
    city: server.City ?? "",
    connectedAt: new Date().toISOString(),
  });

  await showMessage({
    variant: "success",
    title: "Connected",
    body: formatConnectedSummary(server, physical),
    holdMs: 1400,
  });
}

export async function disconnectActive(): Promise<void> {
  const active = await loadActiveTunnel();
  const confPath = active?.confPath ?? wireguardConfPath();
  await bringDown(confPath);
  await clearActiveTunnel();
  await showMessage({
    variant: "success",
    title: "Disconnected",
    body: active
      ? `Stopped tunnel ${active.serverName}`
      : "WireGuard tunnel stopped",
    holdMs: 900,
  });
}
