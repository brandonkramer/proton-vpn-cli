import type { Command } from "commander";
import {
  ensureWireGuardInstalled,
  formatSetupResult,
  isWireGuardInstalled,
} from "../setup/wireguard.ts";
import { showMessage } from "../ui/message.tsx";
import { emitOk, isNonInteractive, wantsJson } from "../util/agent.ts";
import { handleCommandError } from "../util/command.ts";
import { ExitCode } from "../util/exit.ts";

export function registerSetup(program: Command): void {
  program
    .command("setup")
    .description("Install WireGuard tools if they are missing")
    .action(async () => {
      try {
        if (await isWireGuardInstalled()) {
          if (wantsJson()) {
            emitOk({ wireguard: "already-installed" });
            return;
          }
          await showMessage({
            variant: "success",
            title: "Setup",
            body: "WireGuard is already installed.",
            holdMs: 800,
          });
          return;
        }

        // Agent/non-interactive: always attempt install. Humans too (existing UX).
        if (!isNonInteractive()) {
          console.log("WireGuard not found — attempting install...");
        }
        const result = await ensureWireGuardInstalled();
        const body = formatSetupResult(result);

        if (wantsJson()) {
          emitOk({
            wireguard: result.status,
            message: body,
          });
          if (result.status === "failed") {
            process.exitCode = ExitCode.ERROR;
          }
          return;
        }

        await showMessage({
          variant:
            result.status === "installed" || result.status === "already-installed"
              ? "success"
              : "warning",
          title: "Setup",
          body,
          holdMs: 1400,
        });
        if (result.status === "failed") {
          process.exitCode = ExitCode.ERROR;
        }
      } catch (error) {
        await handleCommandError(error);
      }
    });
}
