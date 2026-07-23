import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { TUNNEL_INTERFACE } from "../proton/constants.ts";
import { allowInteractiveSudo, emitPlain, isQuietUi } from "../util/agent.ts";
import { CliError } from "../util/errors.ts";
import { ExitCode } from "../util/exit.ts";

export interface TunnelStatus {
  up: boolean;
  detail: string;
}

const SUDO_PROMPT = "[protonvpn] Enter your macOS login password: ";

function run(
  command: string,
  args: string[],
  options: {
    sudo?: boolean;
    /** sudo -n: never prompt; fail if a password would be required. */
    nonInteractiveSudo?: boolean;
    inheritStdio?: boolean;
  } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let finalCommand = command;
    let finalArgs = args;
    let inherit = Boolean(options.inheritStdio);

    if (options.sudo) {
      finalCommand = "sudo";
      if (options.nonInteractiveSudo) {
        finalArgs = ["-n", command, ...args];
        inherit = false;
      } else {
        finalArgs = ["-p", SUDO_PROMPT, command, ...args];
        inherit = true;
      }
    }

    const child = spawn(finalCommand, finalArgs, {
      stdio: inherit ? ["inherit", "pipe", "inherit"] : ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function warnAboutPrivilege(): void {
  if (isQuietUi()) return;
  if (process.platform === "win32") {
    emitPlain(
      "WireGuard needs Administrator rights (not your Proton password).",
    );
    return;
  }
  emitPlain(
    "WireGuard needs admin rights. If prompted, use your macOS/login password — not your Proton password.",
  );
}

function privilegeError(detail: string): CliError {
  if (process.platform === "win32") {
    return new CliError(
      `${detail}\nRun an Administrator terminal, or elevate before connect/disconnect.`,
      ExitCode.PRIVILEGE,
    );
  }
  return new CliError(
    `${detail}\n` +
      "Privilege required for wg-quick. Options:\n" +
      "  • Run `sudo -v` first (caches credentials), then retry\n" +
      "  • Use `protonvpn --sudo connect …` to allow an interactive sudo prompt\n" +
      "  • Configure NOPASSWD for wg-quick in sudoers for headless/agent use",
    ExitCode.PRIVILEGE,
  );
}

async function runWgQuick(
  confPath: string,
  action: "up" | "down",
): Promise<{ code: number; stdout: string; stderr: string }> {
  // Always try passwordless sudo first (works with cached creds / NOPASSWD).
  const nonInteractive = await run("wg-quick", [action, confPath], {
    sudo: true,
    nonInteractiveSudo: true,
  });
  if (nonInteractive.code === 0) return nonInteractive;

  const combined = `${nonInteractive.stderr}\n${nonInteractive.stdout}`;
  const needsPassword =
    nonInteractive.code !== 0 &&
    (/password is required|a password is required|-n was specified|sudo: a terminal is required/i.test(
      combined,
    ) ||
      nonInteractive.code === 1);

  if (needsPassword && allowInteractiveSudo()) {
    return run("wg-quick", [action, confPath], { sudo: true });
  }

  if (needsPassword) {
    throw privilegeError(
      `Failed to ${action === "up" ? "start" : "stop"} WireGuard tunnel (sudo needs a password).`,
    );
  }

  return nonInteractive;
}

async function commandExists(command: string): Promise<boolean> {
  const checker = process.platform === "win32" ? "where" : "which";
  const result = await run(checker, [command]);
  return result.code === 0;
}

async function findWireGuardWindows(): Promise<string> {
  const candidates = [
    "wireguard",
    String.raw`C:\Program Files\WireGuard\wireguard.exe`,
    String.raw`C:\Program Files (x86)\WireGuard\wireguard.exe`,
  ];

  for (const candidate of candidates) {
    if (candidate === "wireguard") {
      if (await commandExists("wireguard")) return "wireguard";
      continue;
    }
    try {
      await access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }

  throw new CliError(
    "WireGuard for Windows was not found.\n" +
      "Run `protonvpn setup`, or install from https://www.wireguard.com/install/",
  );
}

export async function ensureWireGuardTools(): Promise<void> {
  if (process.platform === "win32") {
    await findWireGuardWindows();
    return;
  }

  if (!(await commandExists("wg-quick"))) {
    throw new CliError(
      "wg-quick was not found.\n" +
        "Run `protonvpn setup` (macOS: needs Homebrew for `wireguard-tools`).",
    );
  }
}

export async function bringUp(confPath: string): Promise<void> {
  await ensureWireGuardTools();
  warnAboutPrivilege();

  if (process.platform === "win32") {
    const wireguard = await findWireGuardWindows();
    const result = await run(wireguard, ["/installtunnelservice", confPath]);
    if (result.code !== 0) {
      const detail = (result.stderr || result.stdout).trim();
      if (/access is denied|administrator|elevat/i.test(detail)) {
        throw privilegeError(`Failed to start WireGuard tunnel.\n${detail}`);
      }
      throw new CliError(
        `Failed to start WireGuard tunnel.\n${detail}`.trim() +
          "\nRun this terminal as Administrator if permission was denied.",
      );
    }
    return;
  }

  const result = await runWgQuick(confPath, "up");
  if (result.code !== 0) {
    const combined = `${result.stderr}\n${result.stdout}`.trim();
    if (/already exists|already up/i.test(combined)) {
      return;
    }
    throw new CliError(
      `Failed to start WireGuard tunnel.\n${combined}\n` +
        "If sudo failed, retry with `protonvpn --sudo connect` or `sudo -v` first.",
    );
  }
}

export async function bringDown(confPath: string): Promise<void> {
  await ensureWireGuardTools();
  warnAboutPrivilege();

  if (process.platform === "win32") {
    const wireguard = await findWireGuardWindows();
    const tunnelName = basename(confPath, ".conf");
    const result = await run(wireguard, ["/uninstalltunnelservice", tunnelName]);
    if (result.code !== 0) {
      const detail = (result.stderr || result.stdout).trim();
      if (/access is denied|administrator|elevat/i.test(detail)) {
        throw privilegeError(`Failed to stop WireGuard tunnel.\n${detail}`);
      }
      throw new CliError(
        `Failed to stop WireGuard tunnel.\n${detail}`.trim() +
          "\nRun this terminal as Administrator if permission was denied.",
      );
    }
    return;
  }

  const result = await runWgQuick(confPath, "down");
  if (result.code !== 0) {
    const combined = `${result.stderr}\n${result.stdout}`.trim();
    if (/is not a WireGuard interface|does not exist|Unable to access interface/i.test(combined)) {
      return;
    }
    throw new CliError(
      `Failed to stop WireGuard tunnel.\n${combined}\n` +
        "If sudo failed, retry with `protonvpn --sudo disconnect` or `sudo -v` first.",
    );
  }
}

export async function tunnelStatus(
  confPath: string,
): Promise<TunnelStatus> {
  if (process.platform === "win32") {
    const tunnelName = basename(confPath, ".conf") || TUNNEL_INTERFACE;
    // Best-effort: query sc for the tunnel service.
    const service = `WireGuardTunnel$${tunnelName}`;
    const result = await run("sc", ["query", service]);
    const up = /RUNNING/i.test(result.stdout);
    return {
      up,
      detail: up
        ? `Windows service ${service} is running`
        : `Windows service ${service} is not running`,
    };
  }

  if (!(await commandExists("wg"))) {
    return { up: false, detail: "wg not installed" };
  }

  const iface = basename(confPath, ".conf") || TUNNEL_INTERFACE;
  const result = await run("wg", ["show", iface]);
  if (result.code === 0 && result.stdout.trim()) {
    return { up: true, detail: result.stdout.trim() };
  }
  return {
    up: false,
    detail: `Interface ${iface} is down`,
  };
}

export function confDirHint(confPath: string): string {
  return dirname(confPath);
}
