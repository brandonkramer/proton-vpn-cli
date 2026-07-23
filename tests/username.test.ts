import { describe, expect, test } from "bun:test";
import { normalizeUsername } from "../src/proton/auth.ts";

describe("normalizeUsername", () => {
  test("strips proton email domain", () => {
    expect(normalizeUsername("brandonkramer@proton.me")).toBe("brandonkramer");
  });

  test("keeps bare username", () => {
    expect(normalizeUsername("brandonkramer")).toBe("brandonkramer");
  });
});
