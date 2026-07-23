#!/usr/bin/env bun
import { Command } from "commander";
import { registerConnect } from "./commands/connect.ts";
import { registerCountries } from "./commands/countries.tsx";
import { registerDisconnect } from "./commands/disconnect.ts";
import { registerServers } from "./commands/servers.tsx";
import { registerSignin } from "./commands/signin.ts";
import { registerSignout } from "./commands/signout.ts";
import { registerStatus } from "./commands/status.tsx";
import { launchTui } from "./tui/launch.ts";

const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json() as {
  version: string;
};

const argv = process.argv.slice(2);

// No args → interactive TUI. Keep flags/commands for scripting.
if (argv.length === 0) {
  await launchTui();
  process.exit(process.exitCode ?? 0);
}

const program = new Command();

program
  .name("protonvpn")
  .description(
    "Unofficial Proton VPN CLI for macOS/Windows (API + system WireGuard).\n" +
      "Run with no arguments to open the interactive TUI.",
  )
  .version(pkg.version);

registerSignin(program);
registerSignout(program);
registerCountries(program);
registerServers(program);
registerConnect(program);
registerDisconnect(program);
registerStatus(program);

program
  .command("tui")
  .description("Open the interactive TUI (same as running with no args)")
  .action(async () => {
    await launchTui();
  });

await program.parseAsync(process.argv);
