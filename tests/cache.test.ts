import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LogicalServer, Session } from "../src/proton/types.ts";
import { VPN_PATH } from "../src/proton/constants.ts";

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

function logical(name: string): LogicalServer {
  return {
    ID: name,
    Name: name,
    EntryCountry: "US",
    ExitCountry: "US",
    Domain: "example.protonvpn.net",
    Tier: 2,
    Features: 0,
    Region: "",
    City: "New York",
    Score: 1,
    Load: 10,
    Status: 1,
    Servers: [
      {
        ID: "p1",
        EntryIP: "1.2.3.4",
        ExitIP: "1.2.3.4",
        Domain: "example.protonvpn.net",
        Status: 1,
        Label: "a",
        X25519PublicKey: "abcd",
      },
    ],
  };
}

describe("logicals cache helpers", () => {
  test("isLogicalsCacheFresh respects TTL", async () => {
    const { isLogicalsCacheFresh } = await import("../src/proton/client.ts");
    const now = Date.parse("2026-07-23T12:00:00.000Z");
    expect(
      isLogicalsCacheFresh(
        {
          fetchedAt: "2026-07-23T11:55:00.000Z",
          etag: null,
          logicalServers: [],
        },
        now,
        10 * 60 * 1000,
      ),
    ).toBe(true);
    expect(
      isLogicalsCacheFresh(
        {
          fetchedAt: "2026-07-23T11:40:00.000Z",
          etag: null,
          logicalServers: [],
        },
        now,
        10 * 60 * 1000,
      ),
    ).toBe(false);
  });

  test("credentialsAreReusable checks username and refreshTime", async () => {
    const { credentialsAreReusable } = await import("../src/proton/client.ts");
    const creds = {
      username: "alice",
      publicKeyPem: "pem",
      x25519PrivateKeyBase64: "key",
      deviceName: "dev",
      refreshTime: 2_000,
      expirationTime: 3_000,
    };
    expect(credentialsAreReusable(creds, "alice", 1_500)).toBe(true);
    expect(credentialsAreReusable(creds, "bob", 1_500)).toBe(false);
    expect(credentialsAreReusable(creds, "alice", 2_000)).toBe(false);
    expect(credentialsAreReusable(creds, "alice", 2_500)).toBe(false);
  });
});

describe("fetchLogicalServers caching", () => {
  let configHome: string;
  let previousXdg: string | undefined;
  let fetchMock: ReturnType<typeof mock>;

  beforeEach(async () => {
    configHome = await mkdtemp(join(tmpdir(), "protonvpn-cache-"));
    previousXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = configHome;

    fetchMock = mock(() =>
      Promise.resolve({
        status: 200,
        data: {
          Code: 1000,
          LogicalServers: [logical("US#1")],
        },
        raw: "",
        etag: '"etag-1"',
      }),
    );

    const client = await import("../src/proton/client.ts");
    client.resetLogicalsMemoryCache();
  });

  afterEach(async () => {
    if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previousXdg;
    await rm(configHome, { recursive: true, force: true });
  });

  test("uses network once then serves from memory/disk within TTL", async () => {
    const { fetchLogicalServers, resetLogicalsMemoryCache } = await import(
      "../src/proton/client.ts"
    );

    const first = await fetchLogicalServers(session, { fetch: fetchMock });
    expect(first[0]?.Name).toBe("US#1");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await fetchLogicalServers(session, { fetch: fetchMock });
    expect(second[0]?.Name).toBe("US#1");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resetLogicalsMemoryCache();
    const third = await fetchLogicalServers(session, { fetch: fetchMock });
    expect(third[0]?.Name).toBe("US#1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("sends If-None-Match and keeps body on 304", async () => {
    const {
      fetchLogicalServers,
      resetLogicalsMemoryCache,
      isLogicalsCacheFresh,
    } = await import("../src/proton/client.ts");
    const { saveLogicalsCache } = await import("../src/config/store.ts");

    await saveLogicalsCache({
      fetchedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      etag: '"etag-1"',
      logicalServers: [logical("US#CACHED")],
    });
    resetLogicalsMemoryCache();

    fetchMock.mockImplementation(() =>
      Promise.resolve({
        status: 304,
        data: undefined,
        raw: "",
        etag: '"etag-1"',
      }),
    );

    const servers = await fetchLogicalServers(session, { fetch: fetchMock });
    expect(servers[0]?.Name).toBe("US#CACHED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers?: Record<string, string> },
    ];
    expect(call[1]?.headers?.["If-None-Match"]).toBe('"etag-1"');

    const { loadLogicalsCache } = await import("../src/config/store.ts");
    const cache = await loadLogicalsCache();
    expect(cache).not.toBeNull();
    expect(isLogicalsCacheFresh(cache!)).toBe(true);
  });

  test("returns stale cache when network fails", async () => {
    const { fetchLogicalServers, resetLogicalsMemoryCache } = await import(
      "../src/proton/client.ts"
    );
    const { saveLogicalsCache } = await import("../src/config/store.ts");

    await saveLogicalsCache({
      fetchedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      etag: null,
      logicalServers: [logical("US#STALE")],
    });
    resetLogicalsMemoryCache();

    fetchMock.mockImplementation(() => {
      throw new Error("network down");
    });

    const servers = await fetchLogicalServers(session, { fetch: fetchMock });
    expect(servers[0]?.Name).toBe("US#STALE");
  });
});

describe("verifySession", () => {
  test("hits /vpn instead of logicals", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        status: 200,
        data: { Code: 1000 },
        raw: "",
        etag: null,
      }),
    );

    const { verifySession } = await import("../src/proton/auth.ts");
    const fetchApi = fetchMock as unknown as typeof import("../src/proton/http.ts").protonFetch;
    await expect(verifySession(session, fetchApi)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string, unknown];
    expect(call[0]).toBe(VPN_PATH);
  });
});
