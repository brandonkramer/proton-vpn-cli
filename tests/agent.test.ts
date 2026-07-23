import { afterEach, describe, expect, test } from "bun:test";
import {
  allowInteractiveSudo,
  configureAgentFlags,
  emitError,
  emitOk,
  isQuietUi,
  shouldLaunchTui,
  wantsJson,
} from "../src/util/agent.ts";
import { ExitCode } from "../src/util/exit.ts";
import { CliError } from "../src/util/errors.ts";

const previous = {
  json: process.env.PROTONVPN_JSON,
  agent: process.env.PROTONVPN_AGENT,
  ci: process.env.CI,
};

afterEach(() => {
  for (const [key, value] of Object.entries({
    PROTONVPN_JSON: previous.json,
    PROTONVPN_AGENT: previous.agent,
    CI: previous.ci,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  configureAgentFlags({ json: false, yes: false, interactiveSudo: false });
});

describe("agent mode", () => {
  test("wantsJson from flag and env", () => {
    configureAgentFlags({ json: true, yes: false, interactiveSudo: false });
    expect(wantsJson()).toBe(true);

    configureAgentFlags({ json: false, yes: false, interactiveSudo: false });
    delete process.env.PROTONVPN_JSON;
    delete process.env.PROTONVPN_AGENT;
    expect(wantsJson()).toBe(false);

    process.env.PROTONVPN_JSON = "1";
    expect(wantsJson()).toBe(true);
  });

  test("isQuietUi when json enabled", () => {
    configureAgentFlags({ json: true, yes: false, interactiveSudo: false });
    expect(isQuietUi()).toBe(true);
  });

  test("allowInteractiveSudo defaults off in json mode", () => {
    configureAgentFlags({ json: true, yes: false, interactiveSudo: false });
    expect(allowInteractiveSudo()).toBe(false);
    configureAgentFlags({ json: true, yes: false, interactiveSudo: true });
    expect(allowInteractiveSudo()).toBe(true);
  });

  test("shouldLaunchTui is false in agent env", () => {
    process.env.PROTONVPN_AGENT = "1";
    configureAgentFlags({ json: false, yes: false, interactiveSudo: false });
    expect(shouldLaunchTui()).toBe(false);
  });

  test("emitOk / emitError JSON shape", () => {
    configureAgentFlags({ json: true, yes: false, interactiveSudo: false });
    const logs: string[] = [];
    const errs: string[] = [];
    const originalOut = process.stdout.write.bind(process.stdout);
    const originalErr = process.stderr.write.bind(process.stderr);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      logs.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      errs.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      emitOk({ signedIn: true, username: "alice" });
      const ok = JSON.parse(logs.join("")) as Record<string, unknown>;
      expect(ok.ok).toBe(true);
      expect(ok.version).toBe(1);
      expect(ok.username).toBe("alice");

      process.exitCode = undefined;
      emitError("nope", ExitCode.NOT_SIGNED_IN);
      const fail = JSON.parse(errs.join("")) as Record<string, unknown>;
      expect(fail.ok).toBe(false);
      expect(fail.code).toBe(ExitCode.NOT_SIGNED_IN);
      expect(fail.error).toBe("nope");
      expect(Number(process.exitCode)).toBe(ExitCode.NOT_SIGNED_IN);
    } finally {
      process.stdout.write = originalOut;
      process.stderr.write = originalErr;
      process.exitCode = undefined;
    }
  });

  test("CliError carries exit code", () => {
    const err = new CliError("need login", ExitCode.NOT_SIGNED_IN);
    expect(err.exitCode).toBe(ExitCode.NOT_SIGNED_IN);
  });
});
