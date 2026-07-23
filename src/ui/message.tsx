import { Box, useApp } from "ink";
import { Alert } from "@inkjs/ui";
import { useEffect, type ReactNode } from "react";
import { emitPlain, isQuietUi, wantsJson } from "../util/agent.ts";
import { Brand } from "./brand.tsx";
import { renderUntilExit } from "./render.tsx";

function MessageApp({
  title,
  variant,
  body,
  holdMs = 900,
}: {
  title: string;
  variant: "success" | "error" | "info" | "warning";
  body?: string;
  holdMs?: number;
}): ReactNode {
  const { exit } = useApp();

  useEffect(() => {
    const timer = setTimeout(() => exit(), holdMs);
    return () => clearTimeout(timer);
  }, [exit, holdMs]);

  return (
    <Box flexDirection="column">
      <Brand />
      <Alert variant={variant} title={title}>
        {body ?? ""}
      </Alert>
    </Box>
  );
}

export async function showMessage(options: {
  title: string;
  variant: "success" | "error" | "info" | "warning";
  body?: string;
  holdMs?: number;
}): Promise<void> {
  if (isQuietUi()) {
    if (!wantsJson()) {
      const text = options.body
        ? `${options.title}: ${options.body}`
        : options.title;
      emitPlain(text);
    }
    return;
  }
  await renderUntilExit(
    <MessageApp
      title={options.title}
      variant={options.variant}
      body={options.body}
      holdMs={options.holdMs}
    />,
  );
}
