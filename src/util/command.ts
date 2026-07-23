import { CliError } from "./errors.ts";
import { showMessage } from "../ui/message.tsx";

export async function handleCommandError(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof CliError || error instanceof Error) {
    await showMessage({
      variant: "error",
      title: "Error",
      body: message,
      holdMs: 1200,
    });
    process.exitCode = 1;
    return;
  }
  throw error;
}
