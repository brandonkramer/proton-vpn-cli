import { describe, expect, test } from "bun:test";
import type { LogicalServer, PhysicalServer } from "../src/proton/types.ts";
import { formatConnectedSummary } from "../src/util/summary.ts";

const server: LogicalServer = {
  ID: "1",
  Name: "US-MA#208",
  EntryCountry: "US",
  ExitCountry: "US",
  Domain: "node.protonvpn.net",
  Tier: 2,
  Features: 4 | 8,
  Region: "",
  City: "Boston",
  Score: 1,
  Load: 33,
  Status: 1,
  Servers: [],
};

const physical: PhysicalServer = {
  ID: "p",
  EntryIP: "203.0.113.10",
  ExitIP: "198.51.100.20",
  Domain: "node.protonvpn.net",
  Status: 1,
  Label: "a",
  X25519PublicKey: "x",
};

describe("formatConnectedSummary", () => {
  test("includes location, protocol, load, features, exit ip", () => {
    const text = formatConnectedSummary(server, physical);
    expect(text).toContain("US-MA#208 · Boston, US");
    expect(text).toContain("WireGuard · Plus · Load 33%");
    expect(text).toContain("Features: P2P, Streaming");
    expect(text).toContain("Exit IP: 198.51.100.20");
  });
});
