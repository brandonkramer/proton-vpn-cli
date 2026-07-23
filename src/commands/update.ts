import type { Command } from "commander";
import { showMessage } from "../ui/message.tsx";
import { emitOk, wantsJson } from "../util/agent.ts";
import { handleCommandError } from "../util/command.ts";
import {
  buildUpdatePlan,
  compareVersions,
  detectInstallChannel,
  fetchLatestVersion,
  runSelfUpdate,
} from "../setup/self-update.ts";

const PACKAGE_JSON_URL = new URL("../../package.json", import.meta.url);

async function currentVersion(): Promise<string> {
  const pkg = (await Bun.file(PACKAGE_JSON_URL).json()) as { version: string };
  return pkg.version;
}

export function registerUpdate(program: Command): void {
  program
    .command("update")
    .description("Update proton-vpn-cli to the latest version (or a given one)")
    .argument("[version]", "Target version (default: latest)")
    .option("--check", "Only check for updates; do not install")
    .action(async (versionArg: string | undefined, opts: { check?: boolean }) => {
      try {
        const current = await currentVersion();
        const channel = detectInstallChannel();
        const target = versionArg?.trim() || "latest";
        const latest =
          target === "latest" ? await fetchLatestVersion() : target;
        const info = compareVersions(current, latest);
        const plan = buildUpdatePlan(channel, target);

        if (opts.check || (target === "latest" && !info.updateAvailable)) {
          if (wantsJson()) {
            emitOk({
              current: info.current,
              latest: info.latest,
              updateAvailable: info.updateAvailable,
              channel: plan.channel,
              checkedOnly: Boolean(opts.check) || !info.updateAvailable,
            });
            return;
          }
          await showMessage({
            variant: info.updateAvailable ? "info" : "success",
            title: opts.check ? "Update check" : "Up to date",
            body: info.updateAvailable
              ? `Current ${info.current} → latest ${info.latest} (${plan.channel}).\nRun \`protonvpn update\` to install.`
              : `Already on latest (${info.current}) via ${plan.channel}.`,
            holdMs: 1200,
          });
          return;
        }

        if (!wantsJson()) {
          console.log(
            `Updating proton-vpn-cli ${info.current} → ${latest} via ${plan.command}…`,
          );
        }

        await runSelfUpdate(plan);
        const after = await currentVersion();

        if (wantsJson()) {
          emitOk({
            updated: true,
            previous: info.current,
            current: after,
            target: latest,
            channel: plan.channel,
            command: [plan.command, ...plan.args].join(" "),
          });
          return;
        }

        await showMessage({
          variant: "success",
          title: "Updated",
          body:
            after === info.current
              ? `Update command finished (${plan.command}). Restart the shell if \`protonvpn --version\` still shows ${info.current}.`
              : `${info.current} → ${after} (${plan.channel})`,
          holdMs: 1400,
        });
      } catch (error) {
        await handleCommandError(error);
      }
    });
}
