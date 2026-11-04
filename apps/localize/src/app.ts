import { Hono } from "hono";

import { negotiate, parseAcceptLanguage } from "./negotiate.ts";

const LANG = "{lang}";
const MAX_AGE = 300;
const MAX_BYTES = 10 * 1024 * 1024;
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const REF = /^[A-Za-z0-9._/-]{1,255}$/;
const TAG = /^[A-Za-z0-9-]{1,35}$/;
const MAX_LANGS = 32;

const USAGE = `svgreel localize

GET /github/<owner>/<repo>/<path with {lang}>.svg?langs=en,ja[&fallback=en][&ref=main]

Returns <path> from the GitHub repository with {lang} replaced by the language in langs that
best matches the request's Accept-Language, or fallback (default: the first of langs).
In an HTML srcset, write the comma as %2C (langs=en%2Cja): a raw comma separates candidates.
`;

/**
 * GET /github/<owner>/<repo>/<path with {lang}>.svg?langs=en,ja[&fallback=en][&ref=main]
 *
 * Serves the file from the repository with `{lang}` replaced by the language that best matches
 * the request's Accept-Language (GitHub's image proxy, camo, forwards the viewer's). `langs`
 * lists the files that exist; `fallback` (default: the first of `langs`) is used when nothing
 * matches; `ref` defaults to the default branch. In a `srcset` (`<picture><source>`), `langs`
 * must use `%2C` for its commas, because a raw comma separates image candidates there; GitHub
 * cuts the URL at it.
 *
 * Tests replace `fetchUpstream`. GET routes also answer HEAD, without a body.
 */
export function createApp(fetchUpstream: typeof fetch = (input, init) => fetch(input, init)): Hono {
  const app = new Hono();

  app.get("/", (c) => c.text(USAGE));

  app.get("/github/*", async (c) => {
    // Parsed from the raw pathname: decoded route parameters would hide encoded slashes.
    const target = parseTarget(new URL(c.req.url));
    if (typeof target === "string") {
      return c.text(target, 400);
    }
    const lang = negotiate(parseAcceptLanguage(c.req.header("accept-language") ?? null), target.langs, target.fallback);
    const path = target.path.replaceAll(LANG, lang);
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    const upstream = await fetchUpstream(
      `https://raw.githubusercontent.com/${target.owner}/${target.repo}/${target.ref}/${encoded}`,
    );
    if (!upstream.ok) {
      return c.text(`Upstream returned ${upstream.status} for ${path}`, upstream.status === 404 ? 404 : 502);
    }
    const length = Number(upstream.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) {
      return c.text(`${path} is larger than ${MAX_BYTES} bytes`, 502);
    }
    // Streams the upstream body through. Hono drops it for HEAD.
    return new Response(upstream.body, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "content-language": lang,
        // Proxies that honor Vary keep one copy per language.
        vary: "Accept-Language",
        "cache-control": `public, max-age=${MAX_AGE}`,
        // The SVG is someone's repository content: no scripts, no external loads.
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
        "x-content-type-options": "nosniff",
      },
    });
  });

  app.all("*", (c) =>
    c.req.method === "GET" || c.req.method === "HEAD"
      ? c.text("Not found", 404)
      : c.text("Method not allowed", 405, { allow: "GET, HEAD" }),
  );

  return app;
}

interface Target {
  owner: string;
  repo: string;
  ref: string;
  path: string;
  langs: string[];
  fallback: string;
}

/** The request's target (a /github/... URL), or an error message. */
function parseTarget(url: URL): Target | string {
  const [, owner = "", repo = "", ...rest] = url.pathname.slice(1).split("/");
  if (!OWNER.test(owner) || !REPO.test(repo)) {
    return "Invalid owner or repository name";
  }
  let segments: string[];
  try {
    segments = rest.map((s) => decodeURIComponent(s));
  } catch {
    return "Invalid file path";
  }
  // The URL parser already resolved literal dot segments; this catches encoded ones (%2F, %5C).
  if (segments.length === 0 || segments.some((s) => s === "" || s === "." || s === ".." || /[/\\]/.test(s))) {
    return "Invalid file path";
  }
  const path = segments.join("/");
  if (!path.includes(LANG) || !path.toLowerCase().endsWith(".svg")) {
    return `The file path must contain ${LANG} and end in .svg`;
  }

  const langs = (url.searchParams.get("langs") ?? "").split(",").filter(Boolean);
  if (langs.length === 0 || langs.length > MAX_LANGS || !langs.every((l) => TAG.test(l))) {
    return `langs must list 1 to ${MAX_LANGS} language tags, like langs=en,ja`;
  }
  const fallback = url.searchParams.get("fallback") ?? langs[0];
  if (!langs.includes(fallback)) {
    return "fallback must be one of langs";
  }
  const ref = url.searchParams.get("ref") ?? "HEAD";
  if (!REF.test(ref) || ref.split("/").includes("..")) {
    return "Invalid ref";
  }
  return {
    owner,
    repo,
    ref,
    path,
    langs,
    fallback,
  };
}
