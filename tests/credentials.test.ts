import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearSession,
  loadWireGuardCredentials,
  saveSession,
  saveWireGuardCredentials,
} from "../src/config/store.ts";
import { credentialsAreReusable } from "../src/proton/client.ts";
import type { Session, WireGuardCredentials } from "../src/proton/types.ts";

const session: Session = {
  Code: 1000,
  AccessToken: "access",
  RefreshToken: "refresh",
  TokenType: "Bearer",
  Scopes: ["vpn"],
  UID: "uid",
  UserID: "user",
  ExpiresIn: 3600,
};

function creds(
  overrides: Partial<WireGuardCredentials> = {},
): WireGuardCredentials {
  return {
    username: "alice",
    publicKeyPem: "-----BEGIN PUBLIC KEY-----\nABC\n-----END PUBLIC KEY-----\n",
    x25519PrivateKeyBase64: "privateKeyBase64===========================",
    deviceName: "proton-vpn-cli-alice-1",
    refreshTime: Math.floor(Date.now() / 1000) + 86_400,
    expirationTime: Math.floor(Date.now() / 1000) + 365 * 86_400,
    ...overrides,
  };
}

describe("wireguard credential persistence", () => {
  let configHome: string;
  let previousXdg: string | undefined;

  beforeEach(async () => {
    configHome = await mkdtemp(join(tmpdir(), "protonvpn-creds-"));
    previousXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = configHome;
  });

  afterEach(async () => {
    if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previousXdg;
    await rm(configHome, { recursive: true, force: true });
  });

  test("loads reusable credentials and rejects past refreshTime", async () => {
    const reusable = creds();
    await saveWireGuardCredentials(reusable);
    const loaded = await loadWireGuardCredentials("alice");
    expect(loaded).not.toBeNull();
    expect(credentialsAreReusable(loaded!, "alice")).toBe(true);

    const expired = creds({
      refreshTime: Math.floor(Date.now() / 1000) - 10,
    });
    await saveWireGuardCredentials(expired);
    const loadedExpired = await loadWireGuardCredentials("alice");
    expect(loadedExpired).not.toBeNull();
    expect(credentialsAreReusable(loadedExpired!, "alice")).toBe(false);
  });

  test("clearSession also removes wireguard credentials", async () => {
    await saveSession(session, "alice");
    await saveWireGuardCredentials(creds());
    expect(await loadWireGuardCredentials("alice")).not.toBeNull();

    await clearSession();
    expect(await loadWireGuardCredentials("alice")).toBeNull();
  });
});
