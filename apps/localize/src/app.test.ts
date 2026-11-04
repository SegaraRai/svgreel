import { describe, expect, it } from "vite-plus/test";

import { createApp } from "./app.ts";

const BASE = "https://localize.example/github/SegaraRai/SegaraRai/assets/banner-%7Blang%7D.svg";

function upstream(body = "<svg/>", status = 200) {
  const calls: string[] = [];
  const app = createApp((async (input: string) => {
    calls.push(input);
    return new Response(body, {
      status,
    });
  }) as typeof fetch);
  return {
    calls,
    request: (url: string, init?: RequestInit) => app.request(url, init),
  };
}

describe("localize app", () => {
  it("serves the file for the best Accept-Language match", async () => {
    const { calls, request } = upstream();
    const res = await request(`${BASE}?langs=en,ja&fallback=en`, { headers: { "accept-language": "ja,en;q=0.8" } });
    expect(calls).toEqual(["https://raw.githubusercontent.com/SegaraRai/SegaraRai/HEAD/assets/banner-ja.svg"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers.get("vary")).toBe("Accept-Language");
    expect(res.headers.get("content-language")).toBe("ja");
    expect(await res.text()).toBe("<svg/>");
  });

  it("accepts an encoded comma in langs, as srcset needs", async () => {
    // A raw comma in srcset separates image candidates, so <source> URLs must use %2C.
    const { calls, request } = upstream();
    await request(`${BASE}?langs=en%2Cja`, { headers: { "accept-language": "ja" } });
    expect(calls).toEqual(["https://raw.githubusercontent.com/SegaraRai/SegaraRai/HEAD/assets/banner-ja.svg"]);
  });

  it("uses the fallback, then the first language, and honors ref", async () => {
    const { calls, request } = upstream();
    await request(`${BASE}?langs=en,ja&fallback=ja`);
    await request(`${BASE}?langs=en,ja&ref=v1.0`, { headers: { "accept-language": "fr" } });
    expect(calls).toEqual([
      "https://raw.githubusercontent.com/SegaraRai/SegaraRai/HEAD/assets/banner-ja.svg",
      "https://raw.githubusercontent.com/SegaraRai/SegaraRai/v1.0/assets/banner-en.svg",
    ]);
  });

  it("rejects bad requests without fetching", async () => {
    const { calls, request } = upstream();
    const status = async (url: string) => (await request(url)).status;
    expect(await status(`${BASE}`)).toBe(400); // no langs
    expect(await status(`${BASE}?langs=en&fallback=ja`)).toBe(400);
    expect(await status(`${BASE}?langs=en,j%20a`)).toBe(400);
    expect(await status("https://localize.example/github/a/b/banner.svg?langs=en")).toBe(400); // no {lang}
    expect(await status("https://localize.example/github/a/b/x%2F..%2F..%2Fc/%7Blang%7D.svg?langs=en")).toBe(400);
    expect(await status("https://localize.example/github/a/b/x//%7Blang%7D.svg?langs=en")).toBe(400);
    expect(await status("https://localize.example/github/a/b/%E0%A4%A/%7Blang%7D.svg?langs=en")).toBe(400);
    expect(await status("https://localize.example/github/a/b/%7Blang%7D.png?langs=en")).toBe(400);
    expect(await status(`${BASE}?langs=en&ref=../x`)).toBe(400);
    expect(calls).toEqual([]);
  });

  it("passes on upstream failures", async () => {
    expect((await upstream("", 404).request(`${BASE}?langs=en`)).status).toBe(404);
    expect((await upstream("", 500).request(`${BASE}?langs=en`)).status).toBe(502);
  });

  it("answers HEAD without a body, 404 for other paths, and refuses other methods", async () => {
    const { request } = upstream();
    const head = await request(`${BASE}?langs=en`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.body).toBeNull();
    expect((await request("https://localize.example/nope")).status).toBe(404);
    expect((await request(`${BASE}?langs=en`, { method: "POST" })).status).toBe(405);
  });
});
