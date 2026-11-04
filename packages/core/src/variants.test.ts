import { describe, expect, it } from "vite-plus/test";

import { expandVariants, normalizeAxes, variantFileName, type VariantAxes } from "./variants.js";

describe("variants", () => {
  it("expands every combination, with motion defaulted and last", () => {
    expect(expandVariants({ theme: ["dark", "light"], lang: ["en", "ja"] })).toEqual([
      { theme: "dark", lang: "en", motion: "default" },
      { theme: "dark", lang: "en", motion: "still" },
      { theme: "dark", lang: "ja", motion: "default" },
      { theme: "dark", lang: "ja", motion: "still" },
      { theme: "light", lang: "en", motion: "default" },
      { theme: "light", lang: "en", motion: "still" },
      { theme: "light", lang: "ja", motion: "default" },
      { theme: "light", lang: "ja", motion: "still" },
    ]);
    expect(expandVariants()).toEqual([{ motion: "default" }, { motion: "still" }]);
    expect(expandVariants({ motion: ["default"], theme: ["dark"] })).toEqual([{ theme: "dark", motion: "default" }]);
  });

  it("names files by value, keeping the pre-0.2 names for theme-only compositions", () => {
    const keys = normalizeAxes({ theme: ["dark"], lang: ["en-US"], motion: ["default", "still", "subtle"] }).map(
      ([k]) => k,
    );
    const name = (motion: string) => variantFileName("banner", { theme: "dark", lang: "en-US", motion }, keys);
    expect(name("default")).toBe("banner-dark-en-US.svg");
    expect(name("still")).toBe("banner-dark-en-US.still.svg");
    expect(name("subtle")).toBe("banner-dark-en-US-subtle.svg");
    expect(variantFileName("hello", { motion: "still" }, ["motion"])).toBe("hello.still.svg");
  });

  it("rejects invalid axes and the old props form", () => {
    expect(() => normalizeAxes({ theme: [] })).toThrow(/no values/);
    expect(() => normalizeAxes({ theme: ["dark", "dark"] })).toThrow(/twice/);
    expect(() => normalizeAxes({ theme: ["dark mode"] })).toThrow(/Invalid value/);
    expect(() => normalizeAxes({ "my-key": ["a"] })).toThrow(/Invalid variant key/);
    expect(() => normalizeAxes({ dark: { text: "#fff" } } as unknown as VariantAxes)).toThrow(/list of values/);
  });
});
