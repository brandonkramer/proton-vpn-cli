import { describe, expect, test } from "bun:test";
import {
  buildUpdatePlan,
  compareVersions,
  detectInstallChannel,
} from "../src/setup/self-update.ts";

describe("detectInstallChannel", () => {
  test("detects bun global path", () => {
    expect(
      detectInstallChannel(
        "/Users/me/.bun/install/global/node_modules/proton-vpn-cli/src/index.ts",
        true,
      ),
    ).toBe("bun");
  });

  test("detects npm global path", () => {
    expect(
      detectInstallChannel(
        "/usr/local/lib/node_modules/proton-vpn-cli/src/index.ts",
        false,
      ),
    ).toBe("npm");
  });

  test("prefers bun when runtime is bun and path is ambiguous", () => {
    expect(
      detectInstallChannel(
        "/opt/node_modules/proton-vpn-cli/src/index.ts",
        true,
      ),
    ).toBe("bun");
  });
});

describe("buildUpdatePlan", () => {
  test("uses bun add -g by default", () => {
    expect(buildUpdatePlan("bun")).toEqual({
      channel: "bun",
      command: "bun",
      args: ["add", "-g", "proton-vpn-cli@latest"],
    });
  });

  test("uses npm install -g for npm channel", () => {
    expect(buildUpdatePlan("npm", "0.3.1")).toEqual({
      channel: "npm",
      command: "npm",
      args: ["install", "-g", "proton-vpn-cli@0.3.1"],
    });
  });
});

describe("compareVersions", () => {
  test("flags when versions differ", () => {
    expect(compareVersions("0.3.0", "0.3.1").updateAvailable).toBe(true);
    expect(compareVersions("0.3.0", "0.3.0").updateAvailable).toBe(false);
  });
});
