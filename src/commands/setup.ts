import type { Command } from "commander";
import {
  ensureWireGuardInstalled,
  formatSetupResult,
  isWireGuardInstalled,
} from "../setup/wireguard.ts";
import { showMessage } from "../ui/message.tsx";
import { handleCommandError } from "../util/command.ts";

export function registerSetup(program: Command): void {
  program
    .command("setup")
    .description("Install WireGuard tools if they are missing")
    .action(async () => {
      try {
        if (await isWireGuardInstalled()) {
          await showMessage({
            variant: "success",
            title: "Setup",
            body: "WireGuard is already installed.",
            holdMs: 800,
          });
          return;
        }

        console.log("WireGuard not found — attempting install...");
        const result = await ensureWireGuardInstalled();
        const body = formatSetupResult(result);
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
          process.exitCode = 1;
        }
      } catch (error) {
        await handleCommandError(error);
      }
    });
}
