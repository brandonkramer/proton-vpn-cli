import { describe, expect, test } from "bun:test";
import { countryName } from "../src/util/countries.ts";

describe("countryName", () => {
  test("resolves common ISO codes", () => {
    expect(countryName("US")).toBe("United States");
    expect(countryName("us")).toBe("United States");
    expect(countryName("NL")).toBe("Netherlands");
    expect(countryName("GB")).toBe("United Kingdom");
  });

  test("falls back for unknown codes", () => {
    expect(countryName("ZZ")).toBe("ZZ");
  });
});
