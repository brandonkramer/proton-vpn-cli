import { saveSession } from "../config/store.ts";
import {
  authInfoRequiresTotp,
  ensureVpnScope,
  getAuthInfo,
  loginWithPassword,
  normalizeUsername,
  sessionNeedsVpnTotp,
  tryExistingSession,
} from "../proton/auth.ts";
import {
  inkPromptPassword,
  inkPromptText,
  inkPromptTotp,
} from "../ui/prompts.tsx";
import { runTask } from "../ui/task.tsx";

/** Interactive sign-in used by the TUI (same UX as `protonvpn signin`). */
export async function runInteractiveSignin(usernameArg?: string): Promise<void> {
  const reused = await runTask({
    title: "Sign in",
    steps: [{ id: "session", label: "Checking saved session" }],
    run: async (ui) => {
      ui.updateStep("session", { status: "running" });
      const existing = await tryExistingSession(usernameArg);
      if (existing) {
        ui.updateStep("session", {
          status: "done",
          detail: existing.username,
        });
        ui.setResult({
          variant: "success",
          title: "Already signed in",
          body: `Using cached session for ${existing.username}`,
        });
        return existing;
      }
      ui.updateStep("session", {
        status: "done",
        detail: "credentials needed",
      });
      return null;
    },
  });
  if (reused) return;

  const entered =
    usernameArg?.trim() ||
    (await inkPromptText("Username or email", {
      placeholder: "you@proton.me",
      hint: "Email is fine — the domain will be stripped for Proton SRP.",
    }));
  const username = normalizeUsername(entered);
  const password = await inkPromptPassword("Proton password", {
    hint: "This is your Proton account password.",
  });

  const needsLoginTotp = await runTask({
    title: "Sign in",
    steps: [{ id: "info", label: "Fetching auth challenge" }],
    note: `Account: ${username}`,
    run: async (ui) => {
      ui.updateStep("info", { status: "running" });
      const info = await getAuthInfo(username);
      const required = authInfoRequiresTotp(info);
      ui.updateStep("info", {
        status: "done",
        detail: required ? "2FA required" : "ready",
      });
      return required;
    },
  });

  const totp = needsLoginTotp ? await inkPromptTotp() : undefined;

  let session = await runTask({
    title: "Sign in",
    steps: [
      { id: "auth", label: "Authenticating with Proton" },
      { id: "scope", label: "Checking VPN scope" },
      { id: "save", label: "Saving session" },
    ],
    note: `Account: ${username}`,
    run: async (ui) => {
      ui.updateStep("auth", { status: "running" });
      const next = await loginWithPassword({ username, password, totp });
      ui.updateStep("auth", { status: "done" });

      ui.updateStep("scope", { status: "running" });
      if (sessionNeedsVpnTotp(next)) {
        ui.updateStep("scope", {
          status: "skipped",
          detail: "needs 2FA upgrade",
        });
        ui.updateStep("save", {
          status: "skipped",
          detail: "waiting",
        });
        return next;
      }

      ui.updateStep("scope", { status: "done" });
      ui.updateStep("save", { status: "running" });
      await saveSession(next, username);
      ui.updateStep("save", { status: "done" });
      ui.setResult({
        variant: "success",
        title: "Signed in",
        body: `Authenticated as ${username}`,
      });
      return next;
    },
  });

  if (sessionNeedsVpnTotp(session)) {
    const upgradeCode = await inkPromptTotp();
    await runTask({
      title: "Sign in",
      steps: [
        { id: "scope", label: "Upgrading session with 2FA" },
        { id: "save", label: "Saving session" },
      ],
      run: async (ui) => {
        ui.updateStep("scope", { status: "running" });
        const upgraded = await ensureVpnScope(session, upgradeCode);
        ui.updateStep("scope", { status: "done" });
        ui.updateStep("save", { status: "running" });
        await saveSession(upgraded, username);
        ui.updateStep("save", { status: "done" });
        ui.setResult({
          variant: "success",
          title: "Signed in",
          body: `Authenticated as ${username}`,
        });
        return upgraded;
      },
    });
  }
}
