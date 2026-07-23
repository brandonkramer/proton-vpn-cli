import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { TUNNEL_INTERFACE } from "../proton/constants.ts";
import { CliError } from "../util/errors.ts";

export interface TunnelStatus {
  up: boolean;
  detail: string;
}

const SUDO_PROMPT = "[protonvpn] Enter your macOS login password: ";

function run(
  command: string,
  args: string[],
  options: { sudo?: boolean } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const finalCommand = options.sudo ? "sudo" : command;
    const finalArgs = options.sudo
      ? ["-p", SUDO_PROMPT, command, ...args]
      : args;

    // Inherit stdin/stderr so the sudo password prompt is visible and typed
    // into the real terminal (piping hides or confuses the prompt).
    const child = spawn(finalCommand, finalArgs, {
      stdio: options.sudo ? ["inherit", "pipe", "inherit"] : ["ignore", "pipe", "pipe"],
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
  if (process.platform === "win32") {
    console.log(
      "WireGuard needs Administrator rights (not your Proton password).",
    );
    return;
  }
  console.log(
    "WireGuard needs admin rights. If prompted, use your macOS/login password — not your Proton password.",
  );
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
      "Install it from https://www.wireguard.com/install/ then retry.",
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
        "Install WireGuard tools (macOS: `brew install wireguard-tools`) then retry.",
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
      throw new CliError(
        `Failed to start WireGuard tunnel.\n${result.stderr || result.stdout}`.trim() +
          "\nRun this terminal as Administrator if permission was denied.",
      );
    }
    return;
  }

  // wg-quick uses the conf basename as interface name; place conf as protonvpn.conf
  const result = await run("wg-quick", ["up", confPath], { sudo: true });
  if (result.code !== 0) {
    const combined = `${result.stderr}\n${result.stdout}`.trim();
    if (/already exists|already up/i.test(combined)) {
      return;
    }
    throw new CliError(
      `Failed to start WireGuard tunnel.\n${combined}\n` +
        "If sudo failed, retry and enter your macOS/login password (not Proton).",
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
      throw new CliError(
        `Failed to stop WireGuard tunnel.\n${result.stderr || result.stdout}`.trim() +
          "\nRun this terminal as Administrator if permission was denied.",
      );
    }
    return;
  }

  const result = await run("wg-quick", ["down", confPath], { sudo: true });
  if (result.code !== 0) {
    const combined = `${result.stderr}\n${result.stdout}`.trim();
    if (/is not a WireGuard interface|does not exist|Unable to access interface/i.test(combined)) {
      return;
    }
    throw new CliError(
      `Failed to stop WireGuard tunnel.\n${combined}\n` +
        "If sudo failed, retry and enter your macOS/login password (not Proton).",
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
