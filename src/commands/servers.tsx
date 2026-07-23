import { Box, Text, useApp } from "ink";
import { StatusMessage } from "@inkjs/ui";
import type { Command } from "commander";
import { useEffect, type ReactNode } from "react";
import { requireSession } from "../proton/auth.ts";
import { fetchLogicalServers } from "../proton/client.ts";
import {
  FEATURE_P2P,
  FEATURE_SECURE_CORE,
  FEATURE_TOR,
  STATUS_ONLINE,
  featureNames,
  tierName,
  type LogicalServer,
} from "../proton/types.ts";
import { Brand } from "../ui/brand.tsx";
import { renderUntilExit } from "../ui/render.tsx";
import { runTask } from "../ui/task.tsx";
import { handleCommandError } from "../util/command.ts";

function ServersTable({
  rows,
  total,
}: {
  rows: LogicalServer[];
  total: number;
}): ReactNode {
  const { exit } = useApp();
  useEffect(() => {
    const timer = setTimeout(() => exit(), 50);
    return () => clearTimeout(timer);
  }, [exit]);

  return (
    <Box flexDirection="column">
      <Brand subtitle="Servers" />
      <StatusMessage variant="success">
        Showing {rows.length} of {total} servers
      </StatusMessage>
      <Box marginTop={1} flexDirection="column">
        <Text bold>
          {"Server".padEnd(16)}
          {"Country".padEnd(9)}
          {"City".padEnd(18)}
          {"Tier".padEnd(10)}
          {"Load".padEnd(7)}
          Features
        </Text>
        <Text dimColor>{"─".repeat(80)}</Text>
        {rows.map((server) => {
          const feats = featureNames(server.Features).join(",") || "-";
          return (
            <Text key={server.ID}>
              {server.Name.padEnd(16)}
              {server.ExitCountry.padEnd(9)}
              {(server.City || "-").slice(0, 16).padEnd(18)}
              {tierName(server.Tier).padEnd(10)}
              {`${server.Load}%`.padEnd(7)}
              {feats}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}

export function registerServers(program: Command): void {
  program
    .command("servers")
    .description("List VPN servers")
    .option("-c, --country <code>", "Filter by exit country code (e.g. US)")
    .option("--city <name>", "Filter by city name")
    .option("--p2p", "Only P2P servers")
    .option("--securecore", "Only Secure Core servers")
    .option("--tor", "Only Tor servers")
    .option("--free-only", "Only Free-tier servers")
    .option("-n, --limit <count>", "Max rows to print", "40")
    .action(async (opts: {
      country?: string;
      city?: string;
      p2p?: boolean;
      securecore?: boolean;
      tor?: boolean;
      freeOnly?: boolean;
      limit: string;
    }) => {
      try {
        const limit = Number.parseInt(opts.limit, 10) || 40;
        const country = opts.country?.toUpperCase();
        const city = opts.city?.toLowerCase();

        const result = await runTask({
          title: "Servers",
          steps: [
            { id: "session", label: "Checking session" },
            { id: "fetch", label: "Downloading server list" },
            { id: "filter", label: "Filtering servers" },
          ],
          note: country ? `Filter: ${country}` : undefined,
          run: async (ui) => {
            ui.updateStep("session", { status: "running" });
            const { session } = await requireSession();
            ui.updateStep("session", { status: "done" });

            ui.updateStep("fetch", { status: "running" });
            const servers = await fetchLogicalServers(session);
            ui.updateStep("fetch", {
              status: "done",
              detail: `${servers.length} total`,
            });

            ui.updateStep("filter", { status: "running" });
            const filtered = servers
              .filter((server) => {
                if (server.Status !== STATUS_ONLINE) return false;
                if (country && server.ExitCountry.toUpperCase() !== country) {
                  return false;
                }
                if (city && server.City.toLowerCase() !== city) return false;
                if (opts.freeOnly && server.Tier !== 0) return false;
                if (
                  opts.securecore &&
                  (server.Features & FEATURE_SECURE_CORE) === 0
                ) {
                  return false;
                }
                if (opts.p2p && (server.Features & FEATURE_P2P) === 0) {
                  return false;
                }
                if (opts.tor && (server.Features & FEATURE_TOR) === 0) {
                  return false;
                }
                return true;
              })
              .sort((a, b) => a.Score - b.Score || a.Load - b.Load);

            ui.updateStep("filter", {
              status: "done",
              detail: `${filtered.length} matches`,
            });
            return {
              rows: filtered.slice(0, limit),
              total: filtered.length,
            };
          },
        });

        await renderUntilExit(
          <ServersTable rows={result.rows} total={result.total} />,
        );
      } catch (error) {
        await handleCommandError(error);
      }
    });
}
