/**
 * Turns one property's per-frame values into a small set of CSS keyframes.
 *
 * Values are split into a "template" (the string with numbers blanked out) and a numeric vector.
 * Consecutive frames sharing a template interpolate linearly in CSS, so each such run is reduced
 * with Ramer–Douglas–Peucker; template changes become hard steps.
 */

const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

export interface Keyframe {
  /** 0..1 */
  t: number;
  value: string;
  /** Hold this value until the next keyframe instead of interpolating. */
  step: boolean;
}

export function fmt(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
}

/** Rounds numbers and turns hex colors into rgb() so they share a template with rgb() values. */
export function normalizeValue(v: string): string {
  return v
    .replace(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi, (_, h: string) => {
      const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
      const n = parseInt(full, 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    })
    .replace(NUM, (m) => fmt(parseFloat(m)));
}

function split(v: string): { template: string; nums: number[] } {
  const nums: number[] = [];
  const template = v.replace(NUM, (m) => {
    nums.push(parseFloat(m));
    return "\u0000";
  });
  return {
    template,
    nums,
  };
}

export function buildKeyframes(values: string[]): Keyframe[] {
  const n = values.length;
  const parsed = values.map(split);
  const keep = new Set<number>();

  let a = 0;
  while (a < n) {
    let b = a;
    while (b + 1 < n && parsed[b + 1].template === parsed[a].template) {
      b++;
    }
    for (const k of simplify(parsed.slice(a, b + 1).map((p) => p.nums))) {
      keep.add(a + k);
    }
    a = b + 1;
  }

  const idx = [...keep].sort((x, y) => x - y);
  const out: Keyframe[] = idx.map((k, i) => {
    const next = idx[i + 1];
    const step = next !== undefined && parsed[next].template !== parsed[k].template;
    return {
      t: k / n,
      value: values[k],
      step,
    };
  });
  // Hold the last sampled frame until the loop restarts.
  out.push({
    t: 1,
    value: values[n - 1],
    step: false,
  });
  return out;
}

/** Indices (into `pts`) to keep so linear interpolation stays within tolerance. */
function simplify(pts: number[][]): number[] {
  const len = pts.length;
  if (len <= 2) {
    return len === 1 ? [0] : [0, 1];
  }
  const dims = pts[0].length;
  const tol: number[] = [];
  for (let d = 0; d < dims; d++) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of pts) {
      lo = Math.min(lo, p[d]);
      hi = Math.max(hi, p[d]);
    }
    tol.push(Math.min(Math.max((hi - lo) * 0.002, 0.001), 0.3));
  }

  const keep = new Uint8Array(len);
  keep[0] = keep[len - 1] = 1;
  const stack: [number, number][] = [[0, len - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    let worst = 0;
    let at = -1;
    for (let k = i + 1; k < j; k++) {
      const f = (k - i) / (j - i);
      for (let d = 0; d < dims; d++) {
        const e = Math.abs(pts[k][d] - (pts[i][d] + (pts[j][d] - pts[i][d]) * f)) / tol[d];
        if (e > worst) {
          worst = e;
          at = k;
        }
      }
    }
    if (worst > 1) {
      keep[at] = 1;
      stack.push([i, at], [at, j]);
    }
  }
  const out: number[] = [];
  keep.forEach((v, i) => v && out.push(i));
  return out;
}
