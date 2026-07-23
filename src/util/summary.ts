import {
  featureNames,
  tierName,
  type LogicalServer,
  type PhysicalServer,
} from "../proton/types.ts";

export function formatConnectedSummary(
  server: LogicalServer,
  physical: PhysicalServer,
): string {
  const location = [server.City, server.ExitCountry].filter(Boolean).join(", ");
  const lines = [
    `${server.Name}${location ? ` · ${location}` : ""}`,
    `WireGuard · ${tierName(server.Tier)} · Load ${server.Load}%`,
  ];

  const features = featureNames(server.Features);
  if (features.length > 0) {
    lines.push(`Features: ${features.join(", ")}`);
  }

  if (
    server.EntryCountry &&
    server.EntryCountry !== server.ExitCountry
  ) {
    lines.push(`Secure Core: ${server.EntryCountry} → ${server.ExitCountry}`);
  }

  const exitIp = physical.ExitIP || physical.EntryIP;
  if (exitIp) {
    lines.push(`Exit IP: ${exitIp}`);
  }

  return lines.join("\n");
}
