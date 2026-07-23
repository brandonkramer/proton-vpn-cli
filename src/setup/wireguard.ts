import { access } from "node:fs/promises";
import { spawn } from "node:child_process";

export type WireGuardSetupResult =
  | { status: "already-installed" }
  | { status: "installed"; via: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string; hint: string };

function run(
  command: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function commandExists(command: string): Promise<boolean> {
  const checker = process.platform === "win32" ? "where" : "which";
  try {
    const result = await run(checker, [command]);
    return result.code === 0;
  } catch {
    return false;
  }
}

async function windowsWireGuardPath(): Promise<string | null> {
  if (await commandExists("wireguard")) return "wireguard";
  for (const candidate of [
    String.raw`C:\Program Files\WireGuard\wireguard.exe`,
    String.raw`C:\Program Files (x86)\WireGuard\wireguard.exe`,
  ]) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }
  return null;
}

export async function isWireGuardInstalled(): Promise<boolean> {
  if (process.platform === "win32") {
    return (await windowsWireGuardPath()) !== null;
  }
  return commandExists("wg-quick");
}

function installHint(): string {
  if (process.platform === "darwin") {
    return "Install Homebrew (https://brew.sh), then: brew install wireguard-tools";
  }
  if (process.platform === "win32") {
    return "Install from https://www.wireguard.com/install/ or: winget install WireGuard.WireGuard";
  }
  return "Install wireguard-tools with your package manager (e.g. apt install wireguard)";
}

/**
 * Detect WireGuard tools and install them when a package manager is available.
 * Never throws — safe for postinstall.
 */
export async function ensureWireGuardInstalled(options: {
  /** When true, skip auto-install (CI / dry check). */
  checkOnly?: boolean;
} = {}): Promise<WireGuardSetupResult> {
  if (await isWireGuardInstalled()) {
    return { status: "already-installed" };
  }

  if (options.checkOnly || process.env.CI === "true") {
    return {
      status: "skipped",
      reason: options.checkOnly
        ? "check-only mode"
        : "CI environment — skipping auto-install",
    };
  }

  try {
    if (process.platform === "darwin") {
      if (!(await commandExists("brew"))) {
        return {
          status: "failed",
          reason: "Homebrew is not installed",
          hint: installHint(),
        };
      }
      console.log("Installing WireGuard tools via Homebrew...");
      const result = await run("brew", ["install", "wireguard-tools"]);
      if (result.code === 0 && (await isWireGuardInstalled())) {
        return { status: "installed", via: "brew install wireguard-tools" };
      }
      return {
        status: "failed",
        reason: (result.stderr || result.stdout || "brew install failed").trim(),
        hint: installHint(),
      };
    }

    if (process.platform === "win32") {
      if (!(await commandExists("winget"))) {
        return {
          status: "failed",
          reason: "winget is not available",
          hint: installHint(),
        };
      }
      console.log("Installing WireGuard via winget (may prompt for Admin)...");
      const result = await run("winget", [
        "install",
        "-e",
        "--id",
        "WireGuard.WireGuard",
        "--accept-package-agreements",
        "--accept-source-agreements",
      ]);
      if (result.code === 0 && (await isWireGuardInstalled())) {
        return { status: "installed", via: "winget install WireGuard.WireGuard" };
      }
      return {
        status: "failed",
        reason: (result.stderr || result.stdout || "winget install failed").trim(),
        hint: installHint(),
      };
    }

    return {
      status: "failed",
      reason: `Automatic install is not supported on ${process.platform}`,
      hint: installHint(),
    };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
      hint: installHint(),
    };
  }
}

export function formatSetupResult(result: WireGuardSetupResult): string {
  switch (result.status) {
    case "already-installed":
      return "WireGuard is already installed.";
    case "installed":
      return `WireGuard installed (${result.via}).`;
    case "skipped":
      return `WireGuard setup skipped: ${result.reason}`;
    case "failed":
      return `Could not install WireGuard automatically: ${result.reason}\n${result.hint}`;
  }
}
