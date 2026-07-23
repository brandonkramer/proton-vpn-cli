import { afterEach, describe, expect, test } from "bun:test";
import {
  normalizePassItemRef,
  PASS_ENV,
  resolvePassRefFromEnv,
} from "../src/pass/credentials.ts";
import { CliError } from "../src/util/errors.ts";

describe("normalizePassItemRef", () => {
  test("accepts pass://Vault/Item", () => {
    expect(normalizePassItemRef("pass://Personal/Proton")).toBe(
      "pass://Personal/Proton",
    );
  });

  test("adds pass:// when missing", () => {
    expect(normalizePassItemRef("Personal/Proton")).toBe(
      "pass://Personal/Proton",
    );
  });

  test("strips trailing field segment", () => {
    expect(normalizePassItemRef("pass://Personal/Proton/password")).toBe(
      "pass://Personal/Proton",
    );
    expect(normalizePassItemRef("Personal/Proton/totp")).toBe(
      "pass://Personal/Proton",
    );
  });

  test("keeps vault names that contain spaces", () => {
    expect(normalizePassItemRef("pass://My Vault/Proton Account")).toBe(
      "pass://My Vault/Proton Account",
    );
  });

  test("rejects incomplete refs", () => {
    expect(() => normalizePassItemRef("pass://Personal")).toThrow(CliError);
    expect(() => normalizePassItemRef("")).toThrow(CliError);
  });
});

describe("resolvePassRefFromEnv", () => {
  const previous = process.env[PASS_ENV];

  afterEach(() => {
    if (previous === undefined) delete process.env[PASS_ENV];
    else process.env[PASS_ENV] = previous;
  });

  test("prefers explicit option over env", () => {
    process.env[PASS_ENV] = "pass://Env/Item";
    expect(resolvePassRefFromEnv("pass://Opt/Item")).toBe("pass://Opt/Item");
  });

  test("falls back to env", () => {
    process.env[PASS_ENV] = "pass://Env/Item";
    expect(resolvePassRefFromEnv()).toBe("pass://Env/Item");
  });

  test("returns undefined when unset", () => {
    delete process.env[PASS_ENV];
    expect(resolvePassRefFromEnv()).toBeUndefined();
  });
});
