/**
 * SVG path geometry without a DOM: length and points along a path, for moving things along it
 * (`offset-path` isn't among the properties the compiler can animate, so motion along a path has
 * to become a per-frame transform).
 */

type Pt = [number, number];

export interface PathPoint {
  x: number;
  y: number;
  /**
   * Direction of travel in degrees (0 = +x, clockwise, as in SVG/CSS rotate()). Continuous along
   * the path (it can go past ±180°), so it is safe to animate.
   */
  angle: number;
}

export interface PathGeometry {
  length: number;
  /** The point at fraction `t` (0 → 1) of the path's length. */
  at(t: number): PathPoint;
}

const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** Splits path data into absolute-or-relative commands with numeric arguments. */
function tokenize(d: string): { cmd: string; args: number[] }[] {
  const out: { cmd: string; args: number[] }[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  let cur: { cmd: string; args: number[] } | undefined;
  for (const m of d.matchAll(re)) {
    if (m[1]) {
      cur = { cmd: m[1], args: [] };
      out.push(cur);
    } else if (cur) {
      cur.args.push(Number(m[2]));
    } else {
      throw new Error(`Path data must start with a command: "${d}"`);
    }
  }
  return out;
}

/** Arc flags may be written without separators ("a1 1 0 011 1"); split them back out. */
function fixArcFlags(d: string): string {
  return d.replace(/([Aa])([^MmLlHhVvCcSsQqTtAaZz]*)/g, (_, cmd: string, body: string) => {
    const nums: string[] = [];
    const re = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
    let i = 0;
    for (const m of body.matchAll(re)) {
      const slot = i % 7;
      if ((slot === 3 || slot === 4) && m[0].length > 1 && /^[01]/.test(m[0])) {
        // A flag glued to the following number(s): "011" = flag 0, flag 1, then "1".
        let rest = m[0];
        while ((i % 7 === 3 || i % 7 === 4) && rest.length > 0 && /^[01]/.test(rest)) {
          nums.push(rest[0]);
          rest = rest.slice(1);
          i++;
        }
        if (rest) {
          nums.push(rest);
          i++;
        }
        continue;
      }
      nums.push(m[0]);
      i++;
    }
    return `${cmd}${nums.join(" ")} `;
  });
}

const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const e = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]];
};

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Samples an elliptical arc (SVG endpoint parameterisation, spec appendix B.2.4). */
function arcPoints(p0: Pt, rx: number, ry: number, rotDeg: number, large: number, sweep: number, p1: Pt): Pt[] {
  if (rx === 0 || ry === 0) {
    return [p1];
  }
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2;
  const dy = (p0[1] - p1[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (k * rx * y1) / ry;
  const cy1 = (-k * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (p0[0] + p1[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (p0[1] + p1[1]) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t0 = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) {
    dt -= 2 * Math.PI;
  } else if (sweep && dt < 0) {
    dt += 2 * Math.PI;
  }
  const steps = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 36)));
  const out: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const a = t0 + (dt * i) / steps;
    const ex = rx * Math.cos(a);
    const ey = ry * Math.sin(a);
    out.push([cos * ex - sin * ey + cx, sin * ex + cos * ey + cy]);
  }
  out[out.length - 1] = p1;
  return out;
}

/** Flattens path data into polylines (one per subpath). */
export function flattenPath(d: string): Pt[][] {
  const subpaths: Pt[][] = [];
  let line: Pt[] = [];
  let pos: Pt = [0, 0];
  let start: Pt = [0, 0];
  let ctrl: Pt | undefined; // last cubic/quadratic control point, for S and T
  let prev = "";
  const curve = (pts: Pt[]) => {
    // Enough segments that each is short; curves are smooth, so ~8 px pieces are accurate.
    const approx = dist(pts[0], pts[1]) + dist(pts[1], pts[2]) + (pts[3] ? dist(pts[2], pts[3]) : 0);
    const steps = Math.min(200, Math.max(8, Math.ceil(approx / 8)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (pts.length === 4) {
        line.push(cubic(pts[0], pts[1], pts[2], pts[3], t));
      } else {
        const u = 1 - t;
        line.push([
          u * u * pts[0][0] + 2 * u * t * pts[1][0] + t * t * pts[2][0],
          u * u * pts[0][1] + 2 * u * t * pts[1][1] + t * t * pts[2][1],
        ]);
      }
    }
  };
  for (const { cmd, args } of tokenize(fixArcFlags(d))) {
    const C = cmd.toUpperCase();
    const rel = cmd !== C;
    const n = ARGS[C];
    const groups =
      n === 0 ? [[]] : Array.from({ length: Math.max(1, args.length / n) }, (_, i) => args.slice(i * n, i * n + n));
    groups.forEach((a, gi) => {
      const abs = (x: number, y: number): Pt => (rel ? [pos[0] + x, pos[1] + y] : [x, y]);
      // Extra pairs after M are implicit L commands.
      const c = C === "M" && gi > 0 ? "L" : C;
      switch (c) {
        case "M":
          if (line.length > 1) {
            subpaths.push(line);
          }
          pos = abs(a[0], a[1]);
          start = pos;
          line = [pos];
          ctrl = undefined;
          break;
        case "L":
        case "H":
        case "V": {
          const next: Pt =
            c === "L"
              ? abs(a[0], a[1])
              : c === "H"
                ? [rel ? pos[0] + a[0] : a[0], pos[1]]
                : [pos[0], rel ? pos[1] + a[0] : a[0]];
          line.push(next);
          pos = next;
          ctrl = undefined;
          break;
        }
        case "C":
        case "S": {
          const c1: Pt =
            c === "C"
              ? abs(a[0], a[1])
              : ctrl && "CS".includes(prev)
                ? [2 * pos[0] - ctrl[0], 2 * pos[1] - ctrl[1]]
                : pos;
          const c2 = c === "C" ? abs(a[2], a[3]) : abs(a[0], a[1]);
          const end = c === "C" ? abs(a[4], a[5]) : abs(a[2], a[3]);
          curve([pos, c1, c2, end]);
          ctrl = c2;
          pos = end;
          break;
        }
        case "Q":
        case "T": {
          const c1: Pt =
            c === "Q"
              ? abs(a[0], a[1])
              : ctrl && "QT".includes(prev)
                ? [2 * pos[0] - ctrl[0], 2 * pos[1] - ctrl[1]]
                : pos;
          const end = c === "Q" ? abs(a[2], a[3]) : abs(a[0], a[1]);
          curve([pos, c1, end]);
          ctrl = c1;
          pos = end;
          break;
        }
        case "A": {
          const end = abs(a[5], a[6]);
          line.push(...arcPoints(pos, a[0], a[1], a[2], a[3], a[4], end));
          pos = end;
          ctrl = undefined;
          break;
        }
        case "Z":
          if (dist(pos, start) > 0) {
            line.push(start);
          }
          pos = start;
          ctrl = undefined;
          break;
      }
      prev = c;
    });
  }
  if (line.length > 1) {
    subpaths.push(line);
  }
  return subpaths;
}

const cache = new Map<string, PathGeometry>();

/**
 * Length of `d` and points along it. Subpaths are joined end to start (the jump between them
 * counts as no length). Results are cached per path string, so calling it every frame is cheap.
 */
export function pathGeometry(d: string): PathGeometry {
  const hit = cache.get(d);
  if (hit) {
    return hit;
  }
  const segs: { a: Pt; b: Pt; at: number; len: number; angle: number }[] = [];
  let length = 0;
  for (const line of flattenPath(d)) {
    for (let i = 1; i < line.length; i++) {
      const len = dist(line[i - 1], line[i]);
      if (len > 0) {
        let angle = (Math.atan2(line[i][1] - line[i - 1][1], line[i][0] - line[i - 1][0]) * 180) / Math.PI;
        // Unwrap: keep each heading within 180° of the previous one, so a rotation animated from
        // these values never spins the long way round (179° → -179° is a 2° turn, not 358°).
        const before = segs[segs.length - 1]?.angle;
        if (before !== undefined) {
          angle += Math.round((before - angle) / 360) * 360;
        }
        segs.push({ a: line[i - 1], b: line[i], at: length, len, angle });
        length += len;
      }
    }
  }
  const geometry: PathGeometry = {
    length,
    at(t) {
      if (!segs.length) {
        return { x: 0, y: 0, angle: 0 };
      }
      const target = Math.min(1, Math.max(0, t)) * length;
      // Binary search for the segment containing `target`.
      let lo = 0;
      let hi = segs.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (segs[mid].at <= target) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      const s = segs[lo];
      const k = Math.min(1, (target - s.at) / s.len);
      return {
        x: s.a[0] + (s.b[0] - s.a[0]) * k,
        y: s.a[1] + (s.b[1] - s.a[1]) * k,
        angle: s.angle,
      };
    },
  };
  cache.set(d, geometry);
  return geometry;
}

/** The point at fraction `t` (0 → 1) of the length of `d`. */
export function pointOnPath(d: string, t: number): PathPoint {
  return pathGeometry(d).at(t);
}
