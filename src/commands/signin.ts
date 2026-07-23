import type { Command } from "commander";
import { PASS_ENV } from "../pass/credentials.ts";
import { runInteractiveSignin } from "../tui/signin-flow.ts";
import { handleCommandError } from "../util/command.ts";

export function registerSignin(program: Command): void {
  program
    .command("signin")
    .argument("[username]", "Proton username or email (overrides Pass username)")
    .option(
      "--pass <ref>",
      `Proton Pass login item (pass://Vault/Item or Vault/Item). Also: $${PASS_ENV}`,
    )
    .description("Sign in to Proton VPN and cache the session")
    .action(async (usernameArg?: string, options?: { pass?: string }) => {
      try {
        await runInteractiveSignin({
          usernameArg,
          passRef: options?.pass,
        });
      } catch (error) {
        await handleCommandError(error);
      }
    });
}
