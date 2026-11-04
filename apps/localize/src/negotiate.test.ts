import { describe, expect, it } from "vite-plus/test";

import { negotiate, parseAcceptLanguage } from "./negotiate.ts";

describe("parseAcceptLanguage", () => {
  it("orders ranges by weight and drops q=0 and *", () => {
    expect(parseAcceptLanguage("ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7,*;q=0.5")).toEqual(["ja-JP", "ja", "en-US", "en"]);
    expect(parseAcceptLanguage("en;q=0.5, fr, de;q=0")).toEqual(["fr", "en"]);
    expect(parseAcceptLanguage(null)).toEqual([]);
  });
});

describe("negotiate", () => {
  const available = ["en", "ja", "en-US", "ja-JP"];
  it("prefers exact matches, then prefixes of the range, then longer tags", () => {
    expect(negotiate(["ja-JP"], available, "en")).toBe("ja-JP");
    expect(negotiate(["ja-JP"], ["en", "ja"], "en")).toBe("ja");
    expect(negotiate(["en"], ["ja", "en-US"], "ja")).toBe("en-US");
    expect(negotiate(["EN-us"], available, "ja")).toBe("en-US");
  });
  it("tries ranges in order and falls back", () => {
    expect(negotiate(["fr", "ja"], available, "en")).toBe("ja");
    expect(negotiate(["fr"], available, "en")).toBe("en");
    expect(negotiate([], available, "ja")).toBe("ja");
  });
});
