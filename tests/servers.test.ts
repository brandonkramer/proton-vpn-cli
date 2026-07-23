import { describe, expect, test } from "bun:test";
import {
  bestPhysicalServer,
  listCountries,
  selectServer,
} from "../src/proton/servers.ts";
import type { LogicalServer } from "../src/proton/types.ts";

function server(
  partial: Partial<LogicalServer> & Pick<LogicalServer, "Name" | "ExitCountry">,
): LogicalServer {
  return {
    ID: partial.ID ?? partial.Name,
    Name: partial.Name,
    EntryCountry: partial.EntryCountry ?? partial.ExitCountry,
    ExitCountry: partial.ExitCountry,
    Domain: partial.Domain ?? "example.protonvpn.net",
    Tier: partial.Tier ?? 2,
    Features: partial.Features ?? 0,
    Region: partial.Region ?? "",
    City: partial.City ?? "",
    Score: partial.Score ?? 1,
    Load: partial.Load ?? 50,
    Status: partial.Status ?? 1,
    Servers: partial.Servers ?? [
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

const fixtures: LogicalServer[] = [
  server({ Name: "US#1", ExitCountry: "US", City: "New York", Score: 2, Load: 40 }),
  server({ Name: "US#2", ExitCountry: "US", City: "Dallas", Score: 1, Load: 70 }),
  server({ Name: "NL#1", ExitCountry: "NL", City: "Amsterdam", Score: 1.5, Load: 20, Features: 4 }),
  server({ Name: "CH#SC", ExitCountry: "US", EntryCountry: "CH", City: "Zurich", Score: 3, Features: 1 }),
  server({ Name: "JP#FREE", ExitCountry: "JP", City: "Tokyo", Score: 1, Tier: 0 }),
  server({ Name: "OFF#1", ExitCountry: "DE", Status: 0, Score: 0.1 }),
];

describe("selectServer", () => {
  test("picks lowest score in a country", () => {
    const picked = selectServer(fixtures, { country: "US" });
    expect(picked.Name).toBe("US#2");
  });

  test("matches city case-insensitively", () => {
    const picked = selectServer(fixtures, { country: "US", city: "new york" });
    expect(picked.Name).toBe("US#1");
  });

  test("matches exact server name", () => {
    const picked = selectServer(fixtures, { serverName: "nl#1" });
    expect(picked.Name).toBe("NL#1");
  });

  test("filters p2p", () => {
    const picked = selectServer(fixtures, { p2p: true });
    expect(picked.Name).toBe("NL#1");
  });

  test("filters free-only", () => {
    const picked = selectServer(fixtures, { freeOnly: true });
    expect(picked.Name).toBe("JP#FREE");
  });

  test("throws when nothing matches", () => {
    expect(() => selectServer(fixtures, { country: "ZZ" })).toThrow(/No suitable/);
  });
});

describe("bestPhysicalServer", () => {
  test("returns first online physical server", () => {
    const logical = server({
      Name: "X#1",
      ExitCountry: "US",
      Servers: [
        {
          ID: "down",
          EntryIP: "9.9.9.9",
          ExitIP: "9.9.9.9",
          Domain: "x",
          Status: 0,
          Label: "a",
          X25519PublicKey: "a",
        },
        {
          ID: "up",
          EntryIP: "8.8.8.8",
          ExitIP: "8.8.8.8",
          Domain: "x",
          Status: 1,
          Label: "b",
          X25519PublicKey: "b",
        },
      ],
    });
    expect(bestPhysicalServer(logical).ID).toBe("up");
  });
});

describe("listCountries", () => {
  test("aggregates online countries", () => {
    const countries = listCountries(fixtures);
    expect(countries.map((c) => c.code)).toEqual(["JP", "NL", "US"]);
    expect(countries.find((c) => c.code === "US")?.count).toBe(3);
  });
});
