import type { Command } from "commander";
import { runInteractiveSignin } from "../tui/signin-flow.ts";
import { handleCommandError } from "../util/command.ts";

export function registerSignin(program: Command): void {
  program
    .command("signin")
    .argument("[username]", "Proton username or email")
    .description("Sign in to Proton VPN and cache the session")
    .action(async (usernameArg?: string) => {
      try {
        await runInteractiveSignin(usernameArg);
      } catch (error) {
        await handleCommandError(error);
      }
    });
}
