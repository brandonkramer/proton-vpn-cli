#!/usr/bin/env bun
import { Command } from "commander";
import { registerConnect } from "./commands/connect.ts";
import { registerCountries } from "./commands/countries.tsx";
import { registerDisconnect } from "./commands/disconnect.ts";
import { registerServers } from "./commands/servers.tsx";
import { registerSetup } from "./commands/setup.ts";
import { registerSignin } from "./commands/signin.ts";
import { registerSignout } from "./commands/signout.ts";
import { registerStatus } from "./commands/status.tsx";
import { launchTui } from "./tui/launch.ts";
import {
  configureAgentFlags,
  emitError,
  shouldLaunchTui,
  wantsJson,
} from "./util/agent.ts";
import { ExitCode } from "./util/exit.ts";

const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json() as {
  version: string;
};

const argv = process.argv.slice(2);

// No args → interactive TUI only on a real TTY (not agents/pipes/CI).
if (argv.length === 0) {
  if (shouldLaunchTui()) {
    await launchTui();
    process.exit(process.exitCode ?? 0);
  }
  emitError(
    "No command given. Examples: protonvpn status --json | connect --country US | tui",
    ExitCode.USAGE,
  );
  process.exit(process.exitCode ?? ExitCode.USAGE);
}

const program = new Command();

program
  .name("protonvpn")
  .description(
    "Unofficial Proton VPN CLI for macOS/Windows (API + system WireGuard).\n" +
      "Run with no arguments in a terminal to open the interactive TUI.",
  )
  .version(pkg.version)
  .option("--json", "Machine-readable JSON on stdout (also: PROTONVPN_JSON=1)")
  .option(
    "-y, --yes",
    "Non-interactive confirmations (also implied by --json / CI)",
  )
  .option(
    "--sudo",
    "Allow interactive sudo password prompt for WireGuard (macOS)",
  );

program.hook("preAction", (thisCommand) => {
  const globals = thisCommand.optsWithGlobals() as {
    json?: boolean;
    yes?: boolean;
    sudo?: boolean;
  };
  configureAgentFlags({
    json: Boolean(globals.json),
    yes: Boolean(globals.yes),
    interactiveSudo: Boolean(globals.sudo),
  });
});

registerSetup(program);
registerSignin(program);
registerSignout(program);
registerCountries(program);
registerServers(program);
registerConnect(program);
registerDisconnect(program);
registerStatus(program);

program
  .command("tui")
  .description("Open the interactive TUI")
  .action(async () => {
    if (!shouldLaunchTui() && wantsJson()) {
      emitError(
        "TUI is not available in JSON/agent mode. Use status, connect, etc.",
        ExitCode.USAGE,
      );
      return;
    }
    if (!shouldLaunchTui()) {
      emitError(
        "TUI requires an interactive terminal (stdin/stdout TTY).",
        ExitCode.USAGE,
      );
      return;
    }
    await launchTui();
  });

await program.parseAsync(process.argv);
