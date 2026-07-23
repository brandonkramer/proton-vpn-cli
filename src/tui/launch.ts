import { clearActiveTunnel } from "../config/store.ts";
import { signOut } from "../proton/auth.ts";
import { showMessage } from "../ui/message.tsx";
import { handleCommandError } from "../util/command.ts";
import { connectWithFilter, disconnectActive } from "./actions.ts";
import { runInteractiveSignin } from "./signin-flow.ts";
import {
  showCountryPicker,
  showHome,
  showServerPicker,
  type TuiIntent,
} from "./screens.tsx";

async function handleIntent(
  intent: TuiIntent,
): Promise<TuiIntent | "home" | "quit"> {
  switch (intent.type) {
    case "quit":
      return "quit";
    case "back-home":
      return "home";
    case "browse-countries":
      return showCountryPicker();
    case "browse-servers":
      return showServerPicker(intent.country);
    case "connect-fastest":
      await connectWithFilter({});
      return "home";
    case "connect-country":
      await connectWithFilter({ country: intent.country });
      return "home";
    case "connect-server":
      await connectWithFilter({ serverName: intent.server });
      return "home";
    case "disconnect":
      await disconnectActive();
      return "home";
    case "signout":
      await signOut();
      await clearActiveTunnel();
      await showMessage({
        variant: "success",
        title: "Signed out",
        body: "Cached Proton session removed.",
        holdMs: 700,
      });
      return "home";
    case "signin":
      await runInteractiveSignin();
      return "home";
    default:
      return "home";
  }
}

export async function launchTui(): Promise<void> {
  let next: TuiIntent | "home" | "quit" = "home";

  while (next !== "quit") {
    try {
      if (next === "home") {
        next = await showHome();
        continue;
      }
      next = await handleIntent(next);
    } catch (error) {
      await handleCommandError(error);
      next = "home";
    }
  }
}
