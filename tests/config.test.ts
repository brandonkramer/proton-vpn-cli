import { describe, expect, test } from "bun:test";
import { renderWireGuardConfig } from "../src/wireguard/config.ts";
import { ed25519SeedToX25519, generateKeyPair } from "../src/wireguard/keys.ts";
import type { LogicalServer, PhysicalServer } from "../src/proton/types.ts";

const logical: LogicalServer = {
  ID: "1",
  Name: "US#99",
  EntryCountry: "US",
  ExitCountry: "US",
  Domain: "node.protonvpn.net",
  Tier: 2,
  Features: 4,
  Region: "",
  City: "New York",
  Score: 1.23,
  Load: 33,
  Status: 1,
  Servers: [],
};

const physical: PhysicalServer = {
  ID: "p",
  EntryIP: "203.0.113.10",
  ExitIP: "203.0.113.11",
  Domain: "node.protonvpn.net",
  Status: 1,
  Label: "a",
  X25519PublicKey: "C3fa/examplePublicKeyBase64ValueAAAAAAAAAAA=",
};

describe("renderWireGuardConfig", () => {
  test("renders interface and peer blocks", () => {
    const conf = renderWireGuardConfig({
      privateKey: "privateKeyBase64===========================",
      peerPublicKey: physical.X25519PublicKey,
      endpointHost: physical.EntryIP,
      server: logical,
      physical,
    });

    expect(conf).toContain("[Interface]");
    expect(conf).toContain("PrivateKey = privateKeyBase64===========================");
    expect(conf).toContain("Address = 10.2.0.2/32");
    expect(conf).toContain("DNS = 10.2.0.1");
    expect(conf).toContain("[Peer]");
    expect(conf).toContain(`PublicKey = ${physical.X25519PublicKey}`);
    expect(conf).toContain("Endpoint = 203.0.113.10:51820");
    expect(conf).toContain("# Server: US#99");
    expect(conf).toContain("# Features: P2P");
  });
});

describe("keys", () => {
  test("ed25519SeedToX25519 clamps bits", () => {
    const seed = Buffer.alloc(32, 0xff);
    const x = ed25519SeedToX25519(seed);
    expect(x.length).toBe(32);
    expect(x[0]! & 0x07).toBe(0);
    expect(x[31]! & 0x80).toBe(0);
    expect(x[31]! & 0x40).toBe(0x40);
  });

  test("generateKeyPair returns PEM and base64 private key", () => {
    const pair = generateKeyPair();
    expect(pair.publicKeyPem).toContain("BEGIN PUBLIC KEY");
    expect(pair.x25519PrivateKeyBase64.length).toBeGreaterThan(40);
  });
});
