import { Box, Text } from "ink";
import type { Command } from "commander";
import { requireSession } from "../proton/auth.ts";
import { fetchLogicalServers } from "../proton/client.ts";
import { listCountries } from "../proton/servers.ts";
import { runTask } from "../ui/task.tsx";
import { Brand } from "../ui/brand.tsx";
import { renderUntilExit } from "../ui/render.tsx";
import { handleCommandError } from "../util/command.ts";
import { useApp } from "ink";
import { useEffect, type ReactNode } from "react";
import { StatusMessage } from "@inkjs/ui";

function CountriesTable({
  rows,
}: {
  rows: Array<{ code: string; cities: string[]; count: number }>;
}): ReactNode {
  const { exit } = useApp();
  useEffect(() => {
    const timer = setTimeout(() => exit(), 50);
    return () => clearTimeout(timer);
  }, [exit]);

  return (
    <Box flexDirection="column">
      <Brand subtitle="Countries" />
      <StatusMessage variant="success">
        {rows.length} exit countries available
      </StatusMessage>
      <Box marginTop={1} flexDirection="column">
        <Text bold>
          {"Code".padEnd(8)}
          {"Servers".padEnd(10)}
          Cities
        </Text>
        <Text dimColor>{"─".repeat(60)}</Text>
        {rows.map((country) => {
          const cities = country.cities.slice(0, 5).join(", ");
          const more =
            country.cities.length > 5
              ? ` (+${country.cities.length - 5} more)`
              : "";
          return (
            <Text key={country.code}>
              {country.code.padEnd(8)}
              {String(country.count).padEnd(10)}
              {cities}
              {more}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}

export function registerCountries(program: Command): void {
  program
    .command("countries")
    .description("List available exit countries")
    .action(async () => {
      try {
        const rows = await runTask({
          title: "Countries",
          steps: [
            { id: "session", label: "Checking session" },
            { id: "fetch", label: "Downloading server list" },
          ],
          run: async (ui) => {
            ui.updateStep("session", { status: "running" });
            const { session } = await requireSession();
            ui.updateStep("session", { status: "done" });

            ui.updateStep("fetch", { status: "running" });
            const servers = await fetchLogicalServers(session);
            const countries = listCountries(servers);
            ui.updateStep("fetch", {
              status: "done",
              detail: `${countries.length} countries`,
            });
            return countries;
          },
        });

        await renderUntilExit(<CountriesTable rows={rows} />);
      } catch (error) {
        await handleCommandError(error);
      }
    });
}
