import { emitError, isQuietUi } from "./agent.ts";
import { CliError } from "./errors.ts";
import { ExitCode } from "./exit.ts";
import { showMessage } from "../ui/message.tsx";

export async function handleCommandError(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const exitCode =
    error instanceof CliError ? error.exitCode : ExitCode.ERROR;

  if (isQuietUi()) {
    emitError(message, exitCode);
    return;
  }

  if (error instanceof CliError || error instanceof Error) {
    await showMessage({
      variant: "error",
      title: "Error",
      body: message,
      holdMs: 1200,
    });
    process.exitCode = exitCode;
    return;
  }
  throw error;
}
