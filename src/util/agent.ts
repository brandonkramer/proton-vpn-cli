/**
 * Agent / scripting mode: JSON output, no Ink holds, non-interactive sudo.
 *
 * Enable via --json, -y/--yes, --sudo, or env:
 *   PROTONVPN_JSON=1  PROTONVPN_AGENT=1  CI=true
 */

export interface AgentFlags {
  json: boolean;
  yes: boolean;
  /** Allow interactive sudo password prompt (macOS). */
  interactiveSudo: boolean;
}

const flags: AgentFlags = {
  json: false,
  yes: false,
  interactiveSudo: false,
};

let configured = false;

export function configureAgentFlags(partial: Partial<AgentFlags>): void {
  if (partial.json !== undefined) flags.json = partial.json;
  if (partial.yes !== undefined) flags.yes = partial.yes;
  if (partial.interactiveSudo !== undefined) {
    flags.interactiveSudo = partial.interactiveSudo;
  }
  configured = true;
}

export function agentFlags(): Readonly<AgentFlags> {
  return flags;
}

function envTruthy(name: string): boolean {
  const value = process.env[name];
  if (!value) return false;
  return value !== "0" && value.toLowerCase() !== "false" && value !== "";
}

/** True when the user/agent asked for machine-readable JSON. */
export function wantsJson(): boolean {
  return (
    flags.json || envTruthy("PROTONVPN_JSON") || envTruthy("PROTONVPN_AGENT")
  );
}

/** True in CI or when explicitly marked as an agent. */
export function isAgentEnv(): boolean {
  return envTruthy("PROTONVPN_AGENT") || envTruthy("CI");
}

/**
 * Quiet UI: skip Ink spinners/holds.
 * JSON mode, agent/CI, or non-TTY stdout.
 */
export function isQuietUi(): boolean {
  return wantsJson() || isAgentEnv() || !process.stdout.isTTY;
}

/** Non-interactive confirmations (--yes / agent / CI / JSON). */
export function isNonInteractive(): boolean {
  return flags.yes || wantsJson() || isAgentEnv() || !process.stdin.isTTY;
}

/**
 * Whether interactive sudo prompts are allowed.
 * Default: only on a TTY when not in JSON/agent/CI mode, unless --sudo.
 */
export function allowInteractiveSudo(): boolean {
  if (flags.interactiveSudo) return true;
  if (wantsJson() || isAgentEnv()) return false;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Launch the TUI only for interactive humans. */
export function shouldLaunchTui(): boolean {
  if (wantsJson() || isAgentEnv()) return false;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function isConfigured(): boolean {
  return configured;
}

/** JSON schema version embedded in agent payloads. */
export const AGENT_SCHEMA_VERSION = 1 as const;

export function emitOk(data: Record<string, unknown>): void {
  if (wantsJson()) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, version: AGENT_SCHEMA_VERSION, ...data })}\n`,
    );
    return;
  }
  // Human plain-text fallback when quiet but not JSON (rare).
  const message = data.message;
  if (typeof message === "string") {
    process.stdout.write(`${message}\n`);
  }
}

export function emitError(
  message: string,
  exitCode: number,
  extra: Record<string, unknown> = {},
): void {
  process.exitCode = exitCode;
  if (wantsJson()) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        version: AGENT_SCHEMA_VERSION,
        error: message,
        code: exitCode,
        ...extra,
      })}\n`,
    );
    return;
  }
  process.stderr.write(`${message}\n`);
}

export function emitPlain(message: string): void {
  if (wantsJson()) return;
  process.stdout.write(`${message}\n`);
}
