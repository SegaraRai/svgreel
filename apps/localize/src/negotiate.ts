/**
 * Language ranges from an Accept-Language header, most preferred first. Ranges with q=0 and the
 * "*" wildcard are dropped; equal weights keep the header's order.
 */
export function parseAcceptLanguage(header: string | null): string[] {
  if (!header) {
    return [];
  }
  return header
    .split(",")
    .map((part, index) => {
      const [range = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q === undefined ? 1 : Number(q.slice(2));
      return { range: range.trim(), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((r) => r.range && r.range !== "*" && r.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((r) => r.range);
}

/**
 * Picks one of `available` for the viewer's ranges, else `fallback`. For each range in order:
 * an exact match, then the range's shorter prefixes ("ja-JP" → "ja"), then an available tag
 * that the range is a prefix of ("en" → "en-US"). Comparison ignores case.
 */
export function negotiate(ranges: readonly string[], available: readonly string[], fallback: string): string {
  const byLower = new Map(available.map((tag) => [tag.toLowerCase(), tag]));
  for (const range of ranges) {
    const subtags = range.toLowerCase().split("-");
    for (let n = subtags.length; n > 0; n--) {
      const hit = byLower.get(subtags.slice(0, n).join("-"));
      if (hit) {
        return hit;
      }
    }
    const prefix = `${subtags.join("-")}-`;
    const longer = available.find((tag) => tag.toLowerCase().startsWith(prefix));
    if (longer) {
      return longer;
    }
  }
  return fallback;
}
