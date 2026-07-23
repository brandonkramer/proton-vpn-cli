import {
  APP_VERSION,
  DEFAULT_API_URL,
  USER_AGENT,
} from "./constants.ts";
import type { Session } from "./types.ts";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  session?: Session | null;
  apiUrl?: string;
}

export async function protonFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ status: number; data: T; raw: string }> {
  const apiUrl = options.apiUrl ?? DEFAULT_API_URL;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-pm-appversion": APP_VERSION,
    "User-Agent": USER_AGENT,
  };

  if (options.session) {
    headers.Authorization = `Bearer ${options.session.AccessToken}`;
    headers["x-pm-uid"] = options.session.UID;
  }

  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const raw = await response.text();
  let data: T;
  try {
    data = JSON.parse(raw) as T;
  } catch {
    throw new Error(
      `Non-JSON response from Proton API (HTTP ${response.status}): ${raw.slice(0, 200)}`,
    );
  }

  return { status: response.status, data, raw };
}
