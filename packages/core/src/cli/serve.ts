/**
 * Watch-mode server: serves the output folder on localhost and answers the preview's live
 * render requests (`POST /_svgreel/render`), which recompile a composition with param values
 * from the preview's controls.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import type { ParamValues } from "../params.js";
import type { Variant } from "../variants.js";

export interface RenderRequest {
  name: string;
  /** Output files to render (the ones the preview shows). */
  files: string[];
  /** Param values from the preview; they win over --param and the defaults. */
  params: ParamValues;
}

export interface RenderedOutput {
  file: string;
  variant: Variant;
  animated: boolean;
  params: ParamValues;
  bytes: number;
  svg: string;
}

export type RenderResponse =
  | { outputs: RenderedOutput[]; ms: number }
  | {
      error: string;
      /** The render was cut off by a rebuild; the preview asks again once it is done. */
      retry?: boolean;
    };

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

/** Request bodies are a few param values; anything bigger is not from the preview. */
const MAX_BODY = 1024 * 1024;

/** Who a watch server is, so a new `--watch` can tell whether it would duplicate it. */
export interface WatchInfo {
  /** Output folder (absolute). Two watches writing one folder would overwrite each other. */
  out: string;
  /** Everything else that changes what gets built (folder, names, --param), as one string. */
  config: string;
  /** The CLI's version and file time: a rebuilt or upgraded CLI needs a new process. */
  cli: string;
  pid: number;
}

export function serve(options: {
  root: string;
  port: number;
  info: WatchInfo;
  render: (req: RenderRequest) => Promise<RenderResponse>;
  /** Called when a newer watch for the same output takes over. */
  onShutdown: () => void;
}): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    void handle(req, res).catch((e: unknown) => {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end(e instanceof Error ? e.message : String(e));
    });
  });

  async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
    // Only same-machine pages addressed by a local name: blocks DNS rebinding.
    const host = (req.headers.host ?? "").replace(/:\d+$/, "");
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
      res.writeHead(403).end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    res.setHeader("cache-control", "no-store");

    if (url.pathname === "/_svgreel/live") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ live: true, ...options.info }));
      return;
    }
    const post = url.pathname === "/_svgreel/render" || url.pathname === "/_svgreel/shutdown";
    // A JSON content type can't be sent cross-origin without a preflight, which isn't answered.
    if (post && (req.method !== "POST" || !req.headers["content-type"]?.startsWith("application/json"))) {
      res.writeHead(400).end();
      return;
    }
    if (url.pathname === "/_svgreel/shutdown") {
      res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
      setImmediate(options.onShutdown);
      return;
    }
    if (url.pathname === "/_svgreel/render") {
      let body = "";
      for await (const chunk of req) {
        body += String(chunk);
        if (body.length > MAX_BODY) {
          res.writeHead(413).end();
          return;
        }
      }
      const result = await options.render(JSON.parse(body) as RenderRequest);
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(options.root, rel);
    if (!file.startsWith(options.root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(file).pipe(res);
  }

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", () => resolve({ url: `http://127.0.0.1:${options.port}/`, close: () => server.close() }));
    server.listen(options.port, "127.0.0.1");
  });
}

/** Ports tried from `--port` on, for the server and when looking for a running watch. */
export const PORT_RANGE = 20;

/** The watch server on `port`, if it is one that reports a WatchInfo. */
export async function probeWatch(port: number): Promise<WatchInfo | undefined> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/_svgreel/live`, { signal: AbortSignal.timeout(1000) });
    const info = (await res.json()) as Partial<WatchInfo>;
    return typeof info.out === "string" && typeof info.config === "string" ? (info as WatchInfo) : undefined;
  } catch {
    return undefined;
  }
}

const samePath = (a: string, b: string) =>
  process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;

/**
 * What to do about a watch that is already running:
 * - "reuse": it serves the same output with the same options and CLI; it rebuilds on its own.
 * - "replace": same output, but other options or an updated CLI; it hands over its port.
 * - "ignore": another project's (or another output's) watch; use another port.
 */
export function compareWatch(running: WatchInfo, mine: WatchInfo): "reuse" | "replace" | "ignore" {
  if (!samePath(running.out, mine.out)) {
    return "ignore";
  }
  return running.config === mine.config && running.cli === mine.cli ? "reuse" : "replace";
}

export type StartResult =
  | { kind: "started"; url: string; close: () => void; replaced?: WatchInfo }
  | { kind: "running"; url: string; running: WatchInfo };

/**
 * Starts the watch server, after checking the ports in range for a watch of the same output:
 * one with the same options is reused (nothing starts), a different one is asked to stop and its
 * port taken over. Otherwise the first free port from `port` on is used.
 */
export async function startWatchServer(options: Parameters<typeof serve>[0]): Promise<StartResult> {
  const ports = Array.from({ length: PORT_RANGE }, (_, i) => options.port + i);
  const found = (await Promise.all(ports.map(async (port) => ({ port, info: await probeWatch(port) })))).find(
    (p) => p.info && compareWatch(p.info, options.info) !== "ignore",
  );
  let replaced: WatchInfo | undefined;
  let first = options.port;
  if (found?.info) {
    if (compareWatch(found.info, options.info) === "reuse") {
      return { kind: "running", url: `http://127.0.0.1:${found.port}/`, running: found.info };
    }
    replaced = found.info;
    await fetch(`http://127.0.0.1:${found.port}/_svgreel/shutdown`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(1000),
    }).catch(() => undefined);
    first = found.port;
  }
  for (let port = first; port < options.port + PORT_RANGE; port++) {
    // The replaced server needs a moment to let go of its port.
    for (let attempt = 0; ; attempt++) {
      try {
        return { kind: "started", ...(await serve({ ...options, port })), replaced };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EADDRINUSE") {
          throw e;
        }
        if (!(replaced && port === first && attempt < 30)) {
          break;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
  throw new Error(`Ports ${options.port}–${options.port + PORT_RANGE - 1} are all in use.`);
}
