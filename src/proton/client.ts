import { mkdir, writeFile, chmod } from "node:fs/promises";
import { dirname } from "node:path";
import {
  clearWireGuardCredentials,
  loadLogicalsCache,
  loadWireGuardCredentials,
  saveLogicalsCache,
  saveWireGuardCredentials,
} from "../config/store.ts";
import { wireguardConfPath } from "../config/paths.ts";
import { CliError, messageForApiCode } from "../util/errors.ts";
import {
  CERTIFICATE_PATH,
  CERT_DURATION,
  LOGICALS_PATH,
  LOGICALS_TTL_MS,
} from "./constants.ts";
import { protonFetch } from "./http.ts";
import {
  isSuccessCode,
  type LogicalServer,
  type LogicalsCache,
  type PhysicalServer,
  type Session,
  type VpnCertificateResponse,
  type WireGuardCredentials,
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

let memoryLogicals: LogicalsCache | null = null;

/** Exposed for tests. */
export function resetLogicalsMemoryCache(): void {
  memoryLogicals = null;
}

export function isLogicalsCacheFresh(
  cache: LogicalsCache,
  now = Date.now(),
  ttlMs = LOGICALS_TTL_MS,
): boolean {
  const fetchedAt = Date.parse(cache.fetchedAt);
  if (Number.isNaN(fetchedAt)) return false;
  return now - fetchedAt < ttlMs;
}

export function credentialsAreReusable(
  credentials: WireGuardCredentials,
  username: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  return (
    credentials.username === username &&
    nowSeconds < credentials.refreshTime &&
    nowSeconds < credentials.expirationTime
  );
}

function setLogicalsCache(cache: LogicalsCache): void {
  memoryLogicals = cache;
}

async function persistLogicalsCache(cache: LogicalsCache): Promise<void> {
  setLogicalsCache(cache);
  await saveLogicalsCache(cache);
}

async function loadCachedLogicals(): Promise<LogicalsCache | null> {
  if (memoryLogicals) return memoryLogicals;
  const disk = await loadLogicalsCache();
  if (disk) setLogicalsCache(disk);
  return disk;
}

export async function fetchLogicalServers(
  session: Session,
): Promise<LogicalServer[]> {
  const cached = await loadCachedLogicals();
  if (cached && isLogicalsCacheFresh(cached)) {
    return cached.logicalServers;
  }

  try {
    const headers: Record<string, string> = {};
    if (cached?.etag) {
      headers["If-None-Match"] = cached.etag;
    }

    const { status, data, etag } = await protonFetch<{
      Code: number;
      LogicalServers: LogicalServer[];
      Error?: string;
    }>(LOGICALS_PATH, { session, headers });

    if (status === 304) {
      if (!cached) {
        throw new CliError(
          "Server returned 304 Not Modified but no logicals cache is available.",
        );
      }
      const touched: LogicalsCache = {
        ...cached,
        fetchedAt: new Date().toISOString(),
        etag: etag ?? cached.etag,
      };
      await persistLogicalsCache(touched);
      return touched.logicalServers;
    }

    if (status !== 200 || !isSuccessCode(data.Code)) {
      if (cached) return cached.logicalServers;
      throw new CliError(
        messageForApiCode(
          data?.Code,
          data?.Error ?? `Failed to fetch servers (HTTP ${status}).`,
        ),
      );
    }

    const next: LogicalsCache = {
      fetchedAt: new Date().toISOString(),
      etag,
      logicalServers: data.LogicalServers ?? [],
    };
    await persistLogicalsCache(next);
    return next.logicalServers;
  } catch (error) {
    if (cached) return cached.logicalServers;
    throw error;
  }
}

export async function createCertificate(
  session: Session,
  publicKeyPem: string,
  deviceName: string,
): Promise<VpnCertificateResponse> {
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

async function resolveKeyPair(
  session: Session,
  username: string,
): Promise<WireGuardKeyPair> {
  const existing = await loadWireGuardCredentials(username);
  if (existing && credentialsAreReusable(existing, username)) {
    return {
      publicKeyPem: existing.publicKeyPem,
      x25519PrivateKeyBase64: existing.x25519PrivateKeyBase64,
    };
  }

  const keyPair = generateKeyPair();
  const deviceName =
    existing?.deviceName ?? `proton-vpn-cli-${username}-${Date.now()}`;
  const cert = await createCertificate(session, keyPair.publicKeyPem, deviceName);

  await saveWireGuardCredentials({
    username,
    publicKeyPem: keyPair.publicKeyPem,
    x25519PrivateKeyBase64: keyPair.x25519PrivateKeyBase64,
    deviceName: cert.DeviceName || deviceName,
    refreshTime: cert.RefreshTime,
    expirationTime: cert.ExpirationTime,
  });

  return keyPair;
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

  let keyPair: WireGuardKeyPair;
  try {
    keyPair = await resolveKeyPair(session, username);
  } catch (error) {
    await clearWireGuardCredentials();
    throw error;
  }

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
