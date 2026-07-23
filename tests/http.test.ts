import { describe, expect, test } from "bun:test";
import { protonFetch } from "../src/proton/http.ts";

describe("protonFetch", () => {
  test("returns etag and tolerates empty 304 bodies", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("", {
        status: 304,
        headers: { ETag: '"abc"' },
      })) as unknown as typeof fetch;

    try {
      const result = await protonFetch<{ Code: number }>("/vpn/v1/logicals", {
        headers: { "If-None-Match": '"abc"' },
      });
      expect(result.status).toBe(304);
      expect(result.etag).toBe('"abc"');
      expect(result.data).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("merges custom headers into the request", async () => {
    const originalFetch = globalThis.fetch;
    let seen: Headers | undefined;
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      seen = new Headers(args[1]?.headers);
      return new Response(JSON.stringify({ Code: 1000 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ETag: '"v2"' },
      });
    }) as unknown as typeof fetch;

    try {
      const result = await protonFetch("/vpn", {
        headers: { "If-None-Match": '"v1"' },
      });
      expect(seen?.get("If-None-Match")).toBe('"v1"');
      expect(result.etag).toBe('"v2"');
      expect(result.status).toBe(200);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
