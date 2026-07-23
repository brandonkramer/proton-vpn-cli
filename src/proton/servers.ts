import {
  FEATURE_P2P,
  FEATURE_SECURE_CORE,
  FEATURE_TOR,
  STATUS_ONLINE,
  type LogicalServer,
  type PhysicalServer,
} from "./types.ts";

export interface ServerFilter {
  country?: string;
  city?: string;
  serverName?: string;
  p2p?: boolean;
  secureCore?: boolean;
  tor?: boolean;
  freeOnly?: boolean;
}

export function selectServer(
  servers: LogicalServer[],
  filter: ServerFilter,
): LogicalServer {
  if (filter.serverName) {
    const exact = servers.find(
      (server) =>
        server.Name.toLowerCase() === filter.serverName!.toLowerCase() &&
        server.Status === STATUS_ONLINE,
    );
    if (!exact) {
      throw new Error(
        `Server "${filter.serverName}" was not found or is offline.`,
      );
    }
    return exact;
  }

  const country = filter.country?.trim().toUpperCase();
  const city = filter.city?.trim().toLowerCase();

  const filtered = servers.filter((server) => {
    if (server.Status !== STATUS_ONLINE) return false;
    if (server.Servers.length === 0) return false;
    if (country && server.ExitCountry.toUpperCase() !== country) return false;
    if (city && server.City.toLowerCase() !== city) return false;
    if (filter.freeOnly && server.Tier !== 0) return false;
    if (filter.secureCore) {
      if ((server.Features & FEATURE_SECURE_CORE) === 0) return false;
    } else if (filter.p2p) {
      if ((server.Features & FEATURE_P2P) === 0) return false;
    }
    if (filter.tor && (server.Features & FEATURE_TOR) === 0) return false;
    return true;
  });

  if (filtered.length === 0) {
    const bits: string[] = [];
    if (country) bits.push(`country ${country}`);
    if (city) bits.push(`city "${filter.city}"`);
    if (filter.secureCore) bits.push("Secure Core");
    if (filter.p2p) bits.push("P2P");
    if (filter.tor) bits.push("Tor");
    if (filter.freeOnly) bits.push("Free tier");
    throw new Error(
      `No suitable online servers found${bits.length ? ` for ${bits.join(", ")}` : ""}.`,
    );
  }

  filtered.sort((a, b) => {
    if (a.Score !== b.Score) return a.Score - b.Score;
    return a.Load - b.Load;
  });

  return filtered[0]!;
}

export function bestPhysicalServer(
  server: LogicalServer,
): PhysicalServer {
  const online = server.Servers.find((s) => s.Status === STATUS_ONLINE);
  return online ?? server.Servers[0]!;
}

export function listCountries(servers: LogicalServer[]): Array<{
  code: string;
  cities: string[];
  count: number;
}> {
  const map = new Map<string, { cities: Set<string>; count: number }>();

  for (const server of servers) {
    if (server.Status !== STATUS_ONLINE) continue;
    const code = server.ExitCountry.toUpperCase();
    const entry = map.get(code) ?? { cities: new Set<string>(), count: 0 };
    entry.count += 1;
    if (server.City) entry.cities.add(server.City);
    map.set(code, entry);
  }

  return [...map.entries()]
    .map(([code, value]) => ({
      code,
      cities: [...value.cities].sort((a, b) => a.localeCompare(b)),
      count: value.count,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
