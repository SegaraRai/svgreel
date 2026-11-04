/**
 * A compile worker of `svgreel build` (see CompilePool in run.ts): compiles one variant per
 * message. Compositions are imported once per worker; the font registry holds one composition's
 * fonts at a time, so it is refilled when the composition changes.
 */

import { parentPort } from "node:worker_threads";

import { compile, type CompileResult } from "../compiler/compile.js";
import { registerFonts } from "../fonts.js";
import type { ParamValues } from "../params.js";
import type { Composition } from "../timeline.js";
import type { Variant } from "../variants.js";

export interface CompileTask {
  id: number;
  /** file: URL of the composition's index.tsx. */
  url: string;
  variant: Variant;
  overrides: ParamValues;
}

export type CompileReply = { id: number; res: CompileResult } | { id: number; error: string };

const loaded = new Map<string, Promise<Composition>>();
let fontsOf: string | undefined;

async function run(task: CompileTask): Promise<CompileReply> {
  try {
    let comp = loaded.get(task.url);
    if (!comp) {
      comp = import(task.url).then((m: { default: Composition }) => m.default);
      loaded.set(task.url, comp);
    }
    const c = await comp;
    if (fontsOf !== task.url) {
      registerFonts(c.fonts ?? []);
      fontsOf = task.url;
    }
    return { id: task.id, res: compile(c, task.variant, task.overrides) };
  } catch (e) {
    return { id: task.id, error: e instanceof Error ? (e.stack ?? e.message) : String(e) };
  }
}

parentPort!.on("message", (task: CompileTask) => {
  void run(task).then((reply) => parentPort!.postMessage(reply));
});
