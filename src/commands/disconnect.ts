import type { Command } from "commander";
import {
  clearActiveTunnel,
  loadActiveTunnel,
} from "../config/store.ts";
import { wireguardConfPath } from "../config/paths.ts";
import { showMessage } from "../ui/message.tsx";
import { runTask } from "../ui/task.tsx";
import { handleCommandError } from "../util/command.ts";
import { bringDown } from "../wireguard/manager.ts";

export function registerDisconnect(program: Command): void {
  program
    .command("disconnect")
    .description("Disconnect the active Proton VPN WireGuard tunnel")
    .action(async () => {
      try {
        const active = await runTask({
          title: "Disconnect",
          steps: [{ id: "meta", label: "Reading active tunnel" }],
          run: async (ui) => {
            ui.updateStep("meta", { status: "running" });
            const tunnel = await loadActiveTunnel();
            ui.updateStep("meta", {
              status: "done",
              detail: tunnel?.serverName ?? "default interface",
            });
            return tunnel;
          },
        });

        const confPath = active?.confPath ?? wireguardConfPath();
        await bringDown(confPath);
        await clearActiveTunnel();

        await showMessage({
          variant: "success",
          title: "Disconnected",
          body: active
            ? `Stopped tunnel ${active.serverName}`
            : "WireGuard tunnel stopped",
          holdMs: 800,
        });
      } catch (error) {
        await handleCommandError(error);
      }
    });
}
