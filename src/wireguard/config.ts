import {
  DEFAULT_ALLOWED_IPS,
  DEFAULT_DNS_IPV4,
  WIREGUARD_IPV4,
  WIREGUARD_PORT,
} from "../proton/constants.ts";
import {
  featureNames,
  tierName,
  type LogicalServer,
  type PhysicalServer,
} from "../proton/types.ts";

export interface WireGuardConfigInput {
  privateKey: string;
  peerPublicKey: string;
  endpointHost: string;
  server: LogicalServer;
  physical: PhysicalServer;
  dns?: string;
  allowedIps?: string;
  address?: string;
  port?: number;
}

export function renderWireGuardConfig(input: WireGuardConfigInput): string {
  const features = featureNames(input.server.Features);
  const lines = [
    "# Proton VPN WireGuard configuration",
    `# Generated: ${new Date().toISOString()}`,
    `# Server: ${input.server.Name}`,
    `# Country: ${input.server.ExitCountry}`,
    `# City: ${input.server.City || "-"}`,
    `# Tier: ${tierName(input.server.Tier)}`,
    `# Load: ${input.server.Load}%`,
    `# Score: ${input.server.Score.toFixed(2)}`,
  ];

  if (features.length > 0) {
    lines.push(`# Features: ${features.join(", ")}`);
  }
  lines.push(`# Entry IP: ${input.physical.EntryIP}`);
  if (
    input.physical.ExitIP &&
    input.physical.ExitIP !== input.physical.EntryIP
  ) {
    lines.push(`# Exit IP: ${input.physical.ExitIP}`);
  }
  lines.push("");
  lines.push("[Interface]");
  lines.push(`PrivateKey = ${input.privateKey}`);
  lines.push(`Address = ${input.address ?? WIREGUARD_IPV4}`);
  lines.push(`DNS = ${input.dns ?? DEFAULT_DNS_IPV4}`);
  lines.push("");
  lines.push("[Peer]");
  lines.push(`PublicKey = ${input.peerPublicKey}`);
  lines.push(`AllowedIPs = ${input.allowedIps ?? DEFAULT_ALLOWED_IPS}`);
  lines.push(
    `Endpoint = ${input.endpointHost}:${input.port ?? WIREGUARD_PORT}`,
  );
  lines.push("");
  return lines.join("\n");
}
