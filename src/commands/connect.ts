import type { Command } from "commander";
import {
  clearActiveTunnel,
  loadActiveTunnel,
  saveActiveTunnel,
} from "../config/store.ts";
import { requireSession } from "../proton/auth.ts";
import { prepareConnection } from "../proton/client.ts";
import { TUNNEL_INTERFACE } from "../proton/constants.ts";
import { showMessage } from "../ui/message.tsx";
import { runTask } from "../ui/task.tsx";
import { emitOk, wantsJson } from "../util/agent.ts";
import { handleCommandError } from "../util/command.ts";
import { countryName } from "../util/countries.ts";
import { formatConnectedSummary } from "../util/summary.ts";
import { bringDown, bringUp } from "../wireguard/manager.ts";

export function registerConnect(program: Command): void {
  program
    .command("connect")
    .argument("[server]", "Optional server name (e.g. US#23)")
    .description("Connect via WireGuard to a Proton VPN server")
    .option("-c, --country <code>", "Exit country code (e.g. US, NL)")
    .option("--city <name>", "City name (e.g. \"New York\")")
    .option("--p2p", "Prefer / require P2P servers")
    .option("--securecore", "Use Secure Core servers")
    .option("--tor", "Use Tor-over-VPN servers")
    .option("--free-only", "Only Free-tier servers")
    .action(
      async (
        serverName: string | undefined,
        opts: {
          country?: string;
          city?: string;
          p2p?: boolean;
          securecore?: boolean;
          tor?: boolean;
          freeOnly?: boolean;
        },
      ) => {
        try {
          const prepared = await runTask({
            title: "Connect",
            steps: [
              { id: "session", label: "Checking session" },
              { id: "replace", label: "Replacing existing tunnel" },
              { id: "cert", label: "Selecting server & creating certificate" },
            ],
            note: opts.country
              ? `Target country: ${opts.country.toUpperCase()}`
              : serverName
                ? `Target server: ${serverName}`
                : "Target: fastest available server",
            run: async (ui) => {
              ui.updateStep("session", { status: "running" });
              const { username, session } = await requireSession();
              ui.updateStep("session", {
                status: "done",
                detail: username,
              });

              ui.updateStep("replace", { status: "running" });
              const existing = await loadActiveTunnel();
              if (existing) {
                ui.updateStep("replace", {
                  status: "skipped",
                  detail: `will stop ${existing.serverName}`,
                });
              } else {
                ui.updateStep("replace", {
                  status: "done",
                  detail: "none",
                });
              }

              ui.updateStep("cert", { status: "running" });
              const { server, physical, confPath } = await prepareConnection(
                session,
                username,
                {
                  serverName,
                  country: opts.country,
                  city: opts.city,
                  p2p: opts.p2p,
                  secureCore: opts.securecore,
                  tor: opts.tor,
                  freeOnly: opts.freeOnly,
                },
              );
              ui.updateStep("cert", {
                status: "done",
                detail: `${server.Name} · ${server.ExitCountry}`,
              });
              return { server, physical, confPath, existing };
            },
          });

          if (prepared.existing) {
            try {
              await bringDown(prepared.existing.confPath);
            } catch {
              // continue
            }
            await clearActiveTunnel();
          }

          await bringUp(prepared.confPath);

          const connectedAt = new Date().toISOString();
          await saveActiveTunnel({
            interfaceName: TUNNEL_INTERFACE,
            confPath: prepared.confPath,
            serverName: prepared.server.Name,
            country: prepared.server.ExitCountry,
            city: prepared.server.City ?? "",
            connectedAt,
          });

          if (wantsJson()) {
            emitOk({
              connected: {
                server: prepared.server.Name,
                country: prepared.server.ExitCountry,
                countryName: countryName(prepared.server.ExitCountry),
                city: prepared.server.City || null,
                load: prepared.server.Load,
                exitIp:
                  prepared.physical.ExitIP || prepared.physical.EntryIP || null,
                connectedAt,
              },
            });
            return;
          }

          await showMessage({
            variant: "success",
            title: "Connected",
            body: formatConnectedSummary(prepared.server, prepared.physical),
            holdMs: 1600,
          });
        } catch (error) {
          await handleCommandError(error);
        }
      },
    );
}
