import { Box, Text, useApp } from "ink";
import { Alert, Spinner, StatusMessage } from "@inkjs/ui";
import type { Command } from "commander";
import { useEffect, useState, type ReactNode } from "react";
import { loadActiveTunnel, loadSession } from "../config/store.ts";
import { wireguardConfPath } from "../config/paths.ts";
import { Brand } from "../ui/brand.tsx";
import { renderUntilExit } from "../ui/render.tsx";
import { handleCommandError } from "../util/command.ts";
import { tunnelStatus } from "../wireguard/manager.ts";

function StatusApp(): ReactNode {
  const { exit } = useApp();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    username: string | null;
    expiresAt: string | null;
    up: boolean;
    serverName?: string;
    location?: string;
    connectedAt?: string;
    detail?: string;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const session = await loadSession();
        const active = await loadActiveTunnel();
        const confPath = active?.confPath ?? wireguardConfPath();
        const status = await tunnelStatus(confPath);
        setData({
          username: session?.username ?? null,
          expiresAt: session?.expiresAt ?? null,
          up: status.up,
          serverName: active?.serverName,
          location: active
            ? `${active.country}${active.city ? `, ${active.city}` : ""}`
            : undefined,
          connectedAt: active?.connectedAt,
          detail: status.detail,
        });
        setPhase("ready");
        setTimeout(() => exit(), 1600);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
        setTimeout(() => exit(), 1200);
      }
    })();
  }, [exit]);

  return (
    <Box flexDirection="column">
      <Brand subtitle="Status" />
      {phase === "loading" ? (
        <Spinner label="Checking session and tunnel" />
      ) : null}
      {phase === "error" && error ? (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      ) : null}
      {phase === "ready" && data ? (
        <Box flexDirection="column">
          <StatusMessage variant={data.username ? "success" : "warning"}>
            {data.username
              ? `Signed in as ${data.username}`
              : "Not signed in"}
          </StatusMessage>
          {data.expiresAt ? (
            <Text dimColor>Session expires: {data.expiresAt}</Text>
          ) : null}
          <Box marginTop={1}>
            <StatusMessage variant={data.up ? "success" : "warning"}>
              Tunnel {data.up ? "up" : "down"}
            </StatusMessage>
          </Box>
          {data.serverName ? <Text>Server: {data.serverName}</Text> : null}
          {data.location ? <Text>Location: {data.location}</Text> : null}
          {data.connectedAt ? (
            <Text dimColor>Connected at: {data.connectedAt}</Text>
          ) : null}
          {data.up && data.detail ? (
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>WireGuard</Text>
              <Text>{data.detail}</Text>
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("Show sign-in and tunnel status")
    .action(async () => {
      try {
        await renderUntilExit(<StatusApp />);
      } catch (error) {
        await handleCommandError(error);
      }
    });
}
