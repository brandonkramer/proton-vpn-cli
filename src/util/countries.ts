const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** English country/region name for an ISO 3166-1 alpha-2 code. */
export function countryName(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return code;
  try {
    const name = regionNames.of(normalized);
    if (!name || /^unknown/i.test(name)) return normalized;
    return name;
  } catch {
    return normalized;
  }
}
