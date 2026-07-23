import { mkdir, writeFile, chmod } from "node:fs/promises";
import { dirname } from "node:path";
import { CliError, messageForApiCode } from "../util/errors.ts";
import { wireguardConfPath } from "../config/paths.ts";
import {
  CERTIFICATE_PATH,
  CERT_DURATION,
  LOGICALS_PATH,
} from "./constants.ts";
import { protonFetch } from "./http.ts";
import {
  isSuccessCode,
  type LogicalServer,
  type PhysicalServer,
  type Session,
  type VpnCertificateResponse,
} from "./types.ts";
import {
  generateKeyPair,
  type WireGuardKeyPair,
} from "../wireguard/keys.ts";
import { renderWireGuardConfig } from "../wireguard/config.ts";
import {
  bestPhysicalServer,
  selectServer,
  type ServerFilter,
} from "./servers.ts";

export async function fetchLogicalServers(
  session: Session,
): Promise<LogicalServer[]> {
  const { status, data } = await protonFetch<{
    Code: number;
    LogicalServers: LogicalServer[];
    Error?: string;
  }>(LOGICALS_PATH, { session });

  if (status !== 200 || !isSuccessCode(data.Code)) {
    throw new CliError(
      messageForApiCode(
        data.Code,
        data.Error ?? `Failed to fetch servers (HTTP ${status}).`,
      ),
    );
  }
  return data.LogicalServers ?? [];
}

export async function createCertificate(
  session: Session,
  username: string,
  publicKeyPem: string,
): Promise<VpnCertificateResponse> {
  const deviceName = `proton-vpn-cli-${username}-${Date.now()}`;
  const { status, data } = await protonFetch<VpnCertificateResponse>(
    CERTIFICATE_PATH,
    {
      method: "POST",
      session,
      body: {
        ClientPublicKey: publicKeyPem,
        ClientPublicKeyMode: "EC",
        Mode: "persistent",
        DeviceName: deviceName,
        Duration: CERT_DURATION,
        Features: {
          NetShieldLevel: 0,
          RandomNAT: true,
          PortForwarding: false,
          SplitTCP: true,
        },
      },
    },
  );

  if (status !== 200 || !isSuccessCode(data.Code)) {
    throw new CliError(
      messageForApiCode(
        data.Code,
        data.Error ?? `Failed to create WireGuard certificate (HTTP ${status}).`,
      ),
    );
  }
  return data;
}

export async function prepareConnection(
  session: Session,
  username: string,
  filter: ServerFilter,
): Promise<{
  server: LogicalServer;
  physical: PhysicalServer;
  confPath: string;
  keyPair: WireGuardKeyPair;
}> {
  const servers = await fetchLogicalServers(session);
  const server = selectServer(servers, filter);
  const physical = bestPhysicalServer(server);
  if (!physical.X25519PublicKey || !physical.EntryIP) {
    throw new CliError(
      `Server ${server.Name} is missing WireGuard endpoint details.`,
    );
  }

  const keyPair = generateKeyPair();
  await createCertificate(session, username, keyPair.publicKeyPem);

  const conf = renderWireGuardConfig({
    privateKey: keyPair.x25519PrivateKeyBase64,
    peerPublicKey: physical.X25519PublicKey,
    endpointHost: physical.EntryIP,
    server,
    physical,
  });

  const confPath = wireguardConfPath();
  await mkdir(dirname(confPath), { recursive: true, mode: 0o700 });
  await writeFile(confPath, conf, { mode: 0o600 });
  try {
    await chmod(confPath, 0o600);
  } catch {
    // ignore on Windows
  }

  return { server, physical, confPath, keyPair };
}
