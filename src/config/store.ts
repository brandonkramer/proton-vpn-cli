import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import type { ActiveTunnel, SavedSession, Session } from "../proton/types.ts";
import {
  configDir,
  sessionPath,
  tunnelMetaPath,
} from "./paths.ts";

async function ensureConfigDir(): Promise<void> {
  await mkdir(configDir(), { recursive: true, mode: 0o700 });
}

export async function saveSession(
  session: Session,
  username: string,
): Promise<void> {
  await ensureConfigDir();
  const expiresAt = new Date(
    Date.now() + Math.max(session.ExpiresIn, 0) * 1000,
  ).toISOString();

  const payload: SavedSession = {
    session,
    username,
    savedAt: new Date().toISOString(),
    expiresAt,
  };

  const path = sessionPath();
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600,
  });
  try {
    await chmod(path, 0o600);
  } catch {
    // Windows may ignore mode bits.
  }
}

export async function loadSession(
  expectedUsername?: string,
): Promise<SavedSession | null> {
  try {
    const raw = await readFile(sessionPath(), "utf8");
    const saved = JSON.parse(raw) as SavedSession;
    if (expectedUsername && saved.username !== expectedUsername) {
      return null;
    }
    if (new Date(saved.expiresAt).getTime() <= Date.now()) {
      await clearSession();
      return null;
    }
    return saved;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await unlink(sessionPath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function saveActiveTunnel(tunnel: ActiveTunnel): Promise<void> {
  await ensureConfigDir();
  const path = tunnelMetaPath();
  await writeFile(path, `${JSON.stringify(tunnel, null, 2)}\n`, {
    mode: 0o600,
  });
  try {
    await chmod(path, 0o600);
  } catch {
    // ignore
  }
}

export async function loadActiveTunnel(): Promise<ActiveTunnel | null> {
  try {
    const raw = await readFile(tunnelMetaPath(), "utf8");
    return JSON.parse(raw) as ActiveTunnel;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function clearActiveTunnel(): Promise<void> {
  try {
    await unlink(tunnelMetaPath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
