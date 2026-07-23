import {
  API_CODE_APP_VERSION_BAD,
  API_CODE_HUMAN_VERIFICATION,
  API_CODE_MAILBOX_PASSWORD,
  API_CODE_PASSWORD_WRONG,
  API_CODE_SCOPE,
} from "../proton/types.ts";
import { ExitCode, type ExitCodeValue } from "./exit.ts";

export class CliError extends Error {
  readonly exitCode: ExitCodeValue;

  constructor(message: string, exitCode: ExitCodeValue = ExitCode.ERROR) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}

export function messageForApiCode(code: number, fallback?: string): string {
  switch (code) {
    case API_CODE_PASSWORD_WRONG:
      return "Authentication failed. Check your username and password.";
    case API_CODE_HUMAN_VERIFICATION:
      return (
        "CAPTCHA / human verification required.\n" +
        "Sign in once at https://account.protonvpn.com from this network, then retry."
      );
    case API_CODE_APP_VERSION_BAD:
      return (
        "Proton rejected this CLI app version header (5003).\n" +
        "Update APP_VERSION in src/proton/constants.ts to a current linux-vpn@X.Y.Z value."
      );
    case API_CODE_MAILBOX_PASSWORD:
      return (
        "This account uses legacy two-password mode, which is not supported.\n" +
        "Switch to one-password mode at account.proton.me → Account and password."
      );
    case API_CODE_SCOPE:
      return (
        "VPN scope missing from session. Sign out and sign in again with TOTP 2FA enabled."
      );
    default:
      return fallback ?? `Proton API error (code ${code}).`;
  }
}
