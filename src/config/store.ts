import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import type {
  ActiveTunnel,
  LogicalsCache,
  SavedSession,
  Session,
  WireGuardCredentials,
} from "../proton/types.ts";
import {
  configDir,
  logicalsCachePath,
  sessionPath,
  tunnelMetaPath,
  wireguardCredentialsPath,
} from "./paths.ts";

async function ensureConfigDir(): Promise<void> {
  await mkdir(configDir(), { recursive: true, mode: 0o700 });
}

async function writeSecureJson(path: string, value: unknown): Promise<void> {
  await ensureConfigDir();
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  try {
    await chmod(path, 0o600);
  } catch {
    // Windows may ignore mode bits.
  }
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function unlinkIfExists(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function saveSession(
  session: Session,
  username: string,
): Promise<void> {
  const expiresAt = new Date(
    Date.now() + Math.max(session.ExpiresIn, 0) * 1000,
  ).toISOString();

  const payload: SavedSession = {
    session,
    username,
    savedAt: new Date().toISOString(),
    expiresAt,
  };

  await writeSecureJson(sessionPath(), payload);
}

export async function loadSession(
  expectedUsername?: string,
): Promise<SavedSession | null> {
  const saved = await readJsonFile<SavedSession>(sessionPath());
  if (!saved) return null;
  if (expectedUsername && saved.username !== expectedUsername) {
    return null;
  }
  if (new Date(saved.expiresAt).getTime() <= Date.now()) {
    await clearSession();
    return null;
  }
  return saved;
}

export async function clearSession(): Promise<void> {
  await unlinkIfExists(sessionPath());
  await clearWireGuardCredentials();
}

export async function saveActiveTunnel(tunnel: ActiveTunnel): Promise<void> {
  await writeSecureJson(tunnelMetaPath(), tunnel);
}

export async function loadActiveTunnel(): Promise<ActiveTunnel | null> {
  return readJsonFile<ActiveTunnel>(tunnelMetaPath());
}

export async function clearActiveTunnel(): Promise<void> {
  await unlinkIfExists(tunnelMetaPath());
}

export async function saveLogicalsCache(cache: LogicalsCache): Promise<void> {
  await writeSecureJson(logicalsCachePath(), cache);
}

export async function loadLogicalsCache(): Promise<LogicalsCache | null> {
  const cache = await readJsonFile<LogicalsCache>(logicalsCachePath());
  if (!cache?.logicalServers || !cache.fetchedAt) return null;
  return cache;
}

export async function clearLogicalsCache(): Promise<void> {
  await unlinkIfExists(logicalsCachePath());
}

export async function saveWireGuardCredentials(
  credentials: WireGuardCredentials,
): Promise<void> {
  await writeSecureJson(wireguardCredentialsPath(), credentials);
}

export async function loadWireGuardCredentials(
  expectedUsername?: string,
): Promise<WireGuardCredentials | null> {
  const saved = await readJsonFile<WireGuardCredentials>(
    wireguardCredentialsPath(),
  );
  if (!saved) return null;
  if (expectedUsername && saved.username !== expectedUsername) return null;
  if (
    typeof saved.refreshTime !== "number" ||
    typeof saved.expirationTime !== "number" ||
    !saved.publicKeyPem ||
    !saved.x25519PrivateKeyBase64
  ) {
    return null;
  }
  return saved;
}

export async function clearWireGuardCredentials(): Promise<void> {
  await unlinkIfExists(wireguardCredentialsPath());
}
