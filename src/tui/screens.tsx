import { Box, Text, useApp, useInput } from "ink";
import { Alert, Select, Spinner, StatusMessage } from "@inkjs/ui";
import { useEffect, useState, type ReactNode } from "react";
import { Brand } from "../ui/brand.tsx";
import { renderPrompt } from "../ui/render.tsx";
import {
  loadCountryOptions,
  loadHomeSnapshot,
  loadServerOptions,
} from "./actions.ts";

export type TuiIntent =
  | { type: "quit" }
  | { type: "signin" }
  | { type: "signout" }
  | { type: "disconnect" }
  | { type: "connect-fastest" }
  | { type: "browse-countries" }
  | { type: "browse-servers"; country?: string }
  | { type: "connect-country"; country: string }
  | { type: "connect-server"; server: string }
  | { type: "back-home" };

function Footer({ text }: { text: string }): ReactNode {
  return (
    <Box marginTop={1}>
      <Text dimColor>{text}</Text>
    </Box>
  );
}

export async function showHome(): Promise<TuiIntent> {
  return renderPrompt<TuiIntent>(({ resolve }) => {
    function Home(): ReactNode {
      const { exit } = useApp();
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [snap, setSnap] = useState<Awaited<
        ReturnType<typeof loadHomeSnapshot>
      > | null>(null);

      useEffect(() => {
        void (async () => {
          try {
            setSnap(await loadHomeSnapshot());
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setLoading(false);
          }
        })();
      }, []);

      useInput((input, key) => {
        if (input === "q" || key.escape) {
          resolve({ type: "quit" });
          exit();
        }
      });

      const options = [
        { label: "Connect to fastest server", value: "connect-fastest" },
        { label: "Browse countries", value: "browse-countries" },
        { label: "Browse servers", value: "browse-servers" },
        ...(snap?.tunnelUp
          ? [{ label: "Disconnect", value: "disconnect" }]
          : []),
        ...(snap?.signedIn
          ? [{ label: "Sign out", value: "signout" }]
          : [{ label: "Sign in", value: "signin" }]),
        { label: "Quit", value: "quit" },
      ];

      return (
        <Box flexDirection="column">
          <Brand subtitle="Interactive mode · ↑↓ enter · q quit" />
          {loading ? <Spinner label="Loading status" /> : null}
          {error ? (
            <Alert variant="error" title="Error">
              {error}
            </Alert>
          ) : null}
          {!loading && snap ? (
            <Box flexDirection="column" marginBottom={1}>
              <StatusMessage variant={snap.signedIn ? "success" : "warning"}>
                {snap.signedIn
                  ? `Signed in as ${snap.username}`
                  : "Not signed in"}
              </StatusMessage>
              <StatusMessage variant={snap.tunnelUp ? "success" : "warning"}>
                {snap.tunnelUp
                  ? `Tunnel up · ${snap.serverName ?? "unknown"}${snap.location ? ` · ${snap.location}` : ""}`
                  : "Tunnel down"}
              </StatusMessage>
            </Box>
          ) : null}
          {!loading ? (
            <Select
              visibleOptionCount={8}
              options={options}
              onChange={(value) => {
                switch (value) {
                  case "connect-fastest":
                    resolve({ type: "connect-fastest" });
                    break;
                  case "browse-countries":
                    resolve({ type: "browse-countries" });
                    break;
                  case "browse-servers":
                    resolve({ type: "browse-servers" });
                    break;
                  case "disconnect":
                    resolve({ type: "disconnect" });
                    break;
                  case "signin":
                    resolve({ type: "signin" });
                    break;
                  case "signout":
                    resolve({ type: "signout" });
                    break;
                  default:
                    resolve({ type: "quit" });
                }
                exit();
              }}
            />
          ) : null}
          <Footer text="Tip: run protonvpn connect --country US for scripting" />
        </Box>
      );
    }

    return <Home />;
  });
}

export async function showCountryPicker(): Promise<TuiIntent> {
  return renderPrompt<TuiIntent>(({ resolve }) => {
    function Countries(): ReactNode {
      const { exit } = useApp();
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [options, setOptions] = useState<
        Array<{ label: string; value: string }>
      >([]);

      useEffect(() => {
        void (async () => {
          try {
            setOptions(await loadCountryOptions());
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setLoading(false);
          }
        })();
      }, []);

      useInput((input, key) => {
        if (input === "q" || key.escape || input === "b") {
          resolve({ type: "back-home" });
          exit();
        }
      });

      return (
        <Box flexDirection="column">
          <Brand subtitle="Countries · enter to connect · b back" />
          {loading ? <Spinner label="Fetching countries" /> : null}
          {error ? (
            <Alert variant="error" title="Error">
              {error}
            </Alert>
          ) : null}
          {!loading && !error ? (
            <Select
              visibleOptionCount={12}
              options={[
                { label: "← Back", value: "__back__" },
                ...options,
              ]}
              onChange={(value) => {
                if (value === "__back__") {
                  resolve({ type: "back-home" });
                } else {
                  resolve({ type: "connect-country", country: value });
                }
                exit();
              }}
            />
          ) : null}
        </Box>
      );
    }

    return <Countries />;
  });
}

export async function showServerPicker(country?: string): Promise<TuiIntent> {
  return renderPrompt<TuiIntent>(({ resolve }) => {
    function Servers(): ReactNode {
      const { exit } = useApp();
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [options, setOptions] = useState<
        Array<{ label: string; value: string }>
      >([]);

      useEffect(() => {
        void (async () => {
          try {
            const rows = await loadServerOptions({ country });
            setOptions(
              rows.map((row) => ({ label: row.label, value: row.value })),
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setLoading(false);
          }
        })();
      }, []);

      useInput((input, key) => {
        if (input === "q" || key.escape || input === "b") {
          resolve({ type: "back-home" });
          exit();
        }
      });

      return (
        <Box flexDirection="column">
          <Brand
            subtitle={`Servers${country ? ` · ${country}` : ""} · enter to connect · b back`}
          />
          {loading ? <Spinner label="Fetching servers" /> : null}
          {error ? (
            <Alert variant="error" title="Error">
              {error}
            </Alert>
          ) : null}
          {!loading && !error ? (
            <Select
              visibleOptionCount={14}
              options={[
                { label: "← Back", value: "__back__" },
                ...options,
              ]}
              onChange={(value) => {
                if (value === "__back__") {
                  resolve({ type: "back-home" });
                } else {
                  resolve({ type: "connect-server", server: value });
                }
                exit();
              }}
            />
          ) : null}
        </Box>
      );
    }

    return <Servers />;
  });
}
