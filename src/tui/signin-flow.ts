import { saveSession } from "../config/store.ts";
import {
  resolvePassLogin,
  resolvePassRefFromEnv,
  resolvePassTotp,
} from "../pass/credentials.ts";
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

export interface SigninOptions {
  usernameArg?: string;
  /** Proton Pass item ref (`pass://Vault/Item` or `Vault/Item`), or from PROTONVPN_PASS. */
  passRef?: string;
}

async function resolveTotp(
  passRef: string | undefined,
  prompt: () => Promise<string>,
): Promise<string> {
  if (passRef) {
    const fromPass = await resolvePassTotp(passRef);
    if (fromPass) return fromPass;
  }
  return prompt();
}

/** Interactive sign-in used by the TUI (same UX as `protonvpn signin`). */
export async function runInteractiveSignin(
  options: SigninOptions | string = {},
): Promise<void> {
  // Backward-compatible: older callers passed a username string.
  const opts: SigninOptions =
    typeof options === "string" ? { usernameArg: options } : options;
  const passRef = resolvePassRefFromEnv(opts.passRef);
  const usernameArg = opts.usernameArg;

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

  let username: string;
  let password: string;

  if (passRef) {
    const fromPass = await runTask({
      title: "Sign in",
      steps: [{ id: "pass", label: "Reading credentials from Proton Pass" }],
      note: passRef,
      run: async (ui) => {
        ui.updateStep("pass", { status: "running" });
        const login = await resolvePassLogin(passRef);
        ui.updateStep("pass", {
          status: "done",
          detail: normalizeUsername(login.username),
        });
        return login;
      },
    });
    username = normalizeUsername(usernameArg?.trim() || fromPass.username);
    password = fromPass.password;
  } else {
    const entered =
      usernameArg?.trim() ||
      (await inkPromptText("Username or email", {
        placeholder: "you@proton.me",
        hint: "Email is fine — the domain will be stripped for Proton SRP.",
      }));
    username = normalizeUsername(entered);
    password = await inkPromptPassword("Proton password", {
      hint: "This is your Proton account password.",
    });
  }

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

  const totp = needsLoginTotp
    ? await resolveTotp(passRef, () => inkPromptTotp())
    : undefined;

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
    const upgradeCode = await resolveTotp(passRef, () => inkPromptTotp());
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
