import type { Command } from "commander";
import { clearActiveTunnel } from "../config/store.ts";
import { signOut } from "../proton/auth.ts";
import { runTask } from "../ui/task.tsx";
import { emitOk, wantsJson } from "../util/agent.ts";
import { handleCommandError } from "../util/command.ts";

export function registerSignout(program: Command): void {
  program
    .command("signout")
    .description("Clear the cached Proton VPN session")
    .action(async () => {
      try {
        await runTask({
          title: "Sign out",
          steps: [
            { id: "session", label: "Clearing session" },
            { id: "tunnel", label: "Clearing tunnel metadata" },
          ],
          run: async (ui) => {
            ui.updateStep("session", { status: "running" });
            await signOut();
            ui.updateStep("session", { status: "done" });

            ui.updateStep("tunnel", { status: "running" });
            await clearActiveTunnel();
            ui.updateStep("tunnel", { status: "done" });

            ui.setResult({
              variant: "success",
              title: "Signed out",
              body: "Cached Proton session removed.",
            });
          },
        });

        if (wantsJson()) {
          emitOk({ signedOut: true });
        }
      } catch (error) {
        await handleCommandError(error);
      }
    });
}
