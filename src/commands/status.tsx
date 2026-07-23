import { Box, Text, useApp } from "ink";
import { Alert, Spinner, StatusMessage } from "@inkjs/ui";
import type { Command } from "commander";
import { useEffect, useState, type ReactNode } from "react";
import { loadActiveTunnel, loadSession } from "../config/store.ts";
import { wireguardConfPath } from "../config/paths.ts";
import { Brand } from "../ui/brand.tsx";
import { renderUntilExit } from "../ui/render.tsx";
import { emitOk, isQuietUi } from "../util/agent.ts";
import { handleCommandError } from "../util/command.ts";
import { tunnelStatus } from "../wireguard/manager.ts";

export async function collectStatus() {
  const session = await loadSession();
  const active = await loadActiveTunnel();
  const confPath = active?.confPath ?? wireguardConfPath();
  const status = await tunnelStatus(confPath);
  return {
    signedIn: Boolean(session),
    username: session?.username ?? null,
    expiresAt: session?.expiresAt ?? null,
    tunnel: {
      up: status.up,
      server: active?.serverName ?? null,
      country: active?.country ?? null,
      city: active?.city ?? null,
      connectedAt: active?.connectedAt ?? null,
      detail: status.detail,
    },
  };
}

function StatusApp(): ReactNode {
  const { exit } = useApp();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof collectStatus>
  > | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setData(await collectStatus());
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
          <StatusMessage variant={data.signedIn ? "success" : "warning"}>
            {data.username
              ? `Signed in as ${data.username}`
              : "Not signed in"}
          </StatusMessage>
          {data.expiresAt ? (
            <Text dimColor>Session expires: {data.expiresAt}</Text>
          ) : null}
          <Box marginTop={1}>
            <StatusMessage variant={data.tunnel.up ? "success" : "warning"}>
              Tunnel {data.tunnel.up ? "up" : "down"}
            </StatusMessage>
          </Box>
          {data.tunnel.server ? (
            <Text>Server: {data.tunnel.server}</Text>
          ) : null}
          {data.tunnel.country ? (
            <Text>
              Location: {data.tunnel.country}
              {data.tunnel.city ? `, ${data.tunnel.city}` : ""}
            </Text>
          ) : null}
          {data.tunnel.connectedAt ? (
            <Text dimColor>Connected at: {data.tunnel.connectedAt}</Text>
          ) : null}
          {data.tunnel.up && data.tunnel.detail ? (
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>WireGuard</Text>
              <Text>{data.tunnel.detail}</Text>
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
        if (isQuietUi()) {
          emitOk(await collectStatus());
          return;
        }
        await renderUntilExit(<StatusApp />);
      } catch (error) {
        await handleCommandError(error);
      }
    });
}
