import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { compareWatch, serve, startWatchServer, type RenderRequest, type WatchInfo } from "./serve.js";

const info = (over: Partial<WatchInfo> = {}): WatchInfo => ({
  out: "/project/dist",
  config: "{}",
  cli: "cli@1",
  pid: 1,
  ...over,
});

describe("watch server", () => {
  let root: string;
  let base: string;
  let close: () => void;
  let shutdowns = 0;
  const requests: RenderRequest[] = [];

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "svgreel-serve-"));
    fs.writeFileSync(path.join(root, "index.html"), "<!doctype html>");
    ({ url: base, close } = await serve({
      root,
      port: 15331,
      info: info({ out: root }),
      render: async (req) => {
        requests.push(req);
        return { outputs: [], ms: 1 };
      },
      onShutdown: () => shutdowns++,
    }));
  });

  afterAll(() => {
    close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("serves files from the output folder only", async () => {
    const index = await fetch(base);
    expect(index.status).toBe(200);
    expect(index.headers.get("content-type")).toContain("text/html");
    expect((await fetch(`${base}..%2f..%2fetc%2fpasswd`)).status).toBe(404);
  });

  it("answers the live probe with who it is, and passes render requests on", async () => {
    expect(await (await fetch(`${base}_svgreel/live`)).json()).toEqual({ live: true, ...info({ out: root }) });
    const req: RenderRequest = { name: "demo", files: ["demo.svg"], params: { accent: "#f00" } };
    const res = await fetch(`${base}_svgreel/render`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    expect(await res.json()).toEqual({ outputs: [], ms: 1 });
    expect(requests).toEqual([req]);
  });

  it("refuses POSTs without a JSON body type (no cross-origin form posts)", async () => {
    expect((await fetch(`${base}_svgreel/render`, { method: "POST", body: "{}" })).status).toBe(400);
    expect((await fetch(`${base}_svgreel/shutdown`, { method: "POST", body: "{}" })).status).toBe(400);
    expect(shutdowns).toBe(0);
  });
});

describe("an existing watch", () => {
  it("is reused with the same output and options, replaced otherwise, and ignored for other outputs", () => {
    expect(compareWatch(info(), info({ pid: 2 }))).toBe("reuse");
    expect(compareWatch(info(), info({ config: '{"names":["a"]}' }))).toBe("replace");
    expect(compareWatch(info(), info({ cli: "cli@2" }))).toBe("replace");
    expect(compareWatch(info(), info({ out: "/other/dist" }))).toBe("ignore");
  });

  const start = (port: number, me: WatchInfo, onShutdown = () => {}) =>
    startWatchServer({ root: os.tmpdir(), port, info: me, render: async () => ({ outputs: [], ms: 0 }), onShutdown });

  it("reuses a running watch instead of starting a second one", async () => {
    const first = await start(15341, info());
    expect(first.kind).toBe("started");
    const second = await start(15341, info({ pid: 2 }));
    expect(second).toMatchObject({ kind: "running", url: "http://127.0.0.1:15341/", running: { pid: 1 } });
    if (first.kind === "started") {
      first.close();
    }
  });

  it("asks a watch with other options to stop, and takes over its port", async () => {
    let close: (() => void) | undefined;
    const first = await start(15351, info(), () => close?.());
    if (first.kind === "started") {
      close = first.close;
    }
    const second = await start(15351, info({ config: '{"names":["a"]}', pid: 2 }));
    expect(second).toMatchObject({ kind: "started", url: "http://127.0.0.1:15351/", replaced: { pid: 1 } });
    if (second.kind === "started") {
      second.close();
    }
  });

  it("leaves another project's watch alone and uses the next port", async () => {
    const first = await start(15361, info({ out: "/other/dist" }));
    const second = await start(15361, info());
    expect(second).toMatchObject({ kind: "started", url: "http://127.0.0.1:15362/" });
    for (const s of [first, second]) {
      if (s.kind === "started") {
        s.close();
      }
    }
  });
});
