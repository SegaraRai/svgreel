import { useAudioOffset, useCurrentFrame, useTimelineFrame, useVideoConfig } from "../timeline.js";

/**
 * Beat data for a piece of music, as written by `beatmap.py export` (see docs/audio.md). Times
 * are seconds in the audio file. Beats need not be evenly spaced, so tempo changes, free-time
 * stretches and additive meters (3+2) are all plain beat lists.
 */
export interface BeatMap {
  /** Typical pulse tempo (median). Only used as the length of the last beat. */
  bpm: number;
  /** Pulses in the longest bar. */
  meter: number;
  /** Additive bar pattern in grid steps, e.g. "3+2,3+3"; null for regular meters. */
  pattern?: string | null;
  /** `[time, position in bar (1 = downbeat), loudness in dB relative to the loudest beat]` */
  beats: readonly (readonly number[])[];
  /** Grid beats between pulses (the finer subdivision). */
  sub?: readonly number[];
  /** Section starts, on downbeats. */
  sections: readonly number[];
  /** `[time, strength 0..1]` of sound attacks (drum hits, plucks). */
  onsets: readonly (readonly number[])[];
  /** `[start, end]` stretches where the music marks the beat weakly. */
  lowConfidence?: readonly (readonly number[])[];
  /** Tempo segments. `bpm: null` and `free: true` mark free time (no steady tempo). */
  tempo?: readonly { start: number; bpm: number | null; free: boolean }[];
}

export interface BeatOptions {
  /**
   * Timeline seconds at which the audio file's 0 s plays. Defaults to the composition's
   * `audio.offset`, so leave it out unless the beat map belongs to a different track.
   */
  offset?: number;
}

export interface BeatState {
  /** Index into `map.beats`; -1 before the first beat. */
  index: number;
  /** Position in the bar, 1-based (1 = downbeat); 0 before the first beat. */
  pos: number;
  /** Bar number, 0-based from the first downbeat; -1 before it. */
  bar: number;
  /** Frames since the current beat started (0 on the beat's frame). */
  since: number;
  /** Frames from the current beat to the next one. */
  length: number;
  /** 0..1 through the current beat. */
  progress: number;
  /** Loudness of the current beat in dB, relative to the loudest beat (≤ 0). */
  db: number;
  isDownbeat: boolean;
}

/**
 * Frame on which a moment of the audio is shown. Rounds down: a hit up to one frame early goes
 * unnoticed, while a late one looks off (viewers accept sound lagging the picture far more than
 * the reverse).
 */
export function timeToFrame(seconds: number, fps: number, offset = 0): number {
  return Math.floor((seconds + offset) * fps + 1e-6);
}

/** Index of the last entry ≤ frame, or -1. */
function lastAtOrBefore(frames: readonly number[], frame: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid]! <= frame) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

interface Frames {
  beats: number[];
  bars: number[];
  sections: number[];
  onsets: number[];
}

const cache = new WeakMap<BeatMap, Map<string, Frames>>();

function framesOf(map: BeatMap, fps: number, offset: number): Frames {
  let byKey = cache.get(map);
  if (!byKey) {
    byKey = new Map();
    cache.set(map, byKey);
  }
  const key = `${fps}:${offset}`;
  let f = byKey.get(key);
  if (!f) {
    let bar = -1;
    f = {
      beats: map.beats.map(([t]) => timeToFrame(t, fps, offset)),
      // Count downbeats instead of dividing by the meter: bars may differ in length (3+2 / 3+3).
      bars: map.beats.map(([, pos]) => (pos === 1 ? ++bar : bar)),
      sections: map.sections.map((t) => timeToFrame(t, fps, offset)),
      onsets: map.onsets.map(([t]) => timeToFrame(t, fps, offset)),
    };
    byKey.set(key, f);
  }
  return f;
}

/** The beat at `frame` (a composition-level frame). The pure form of `useBeat()`. */
export function beatAt(map: BeatMap, frame: number, fps: number, offset = 0): BeatState {
  const f = framesOf(map, fps, offset);
  const i = lastAtOrBefore(f.beats, frame);
  const period = Math.max(1, Math.round((60 / map.bpm) * fps));
  if (i < 0) {
    return { index: -1, pos: 0, bar: -1, since: 0, length: period, progress: 0, db: -60, isDownbeat: false };
  }
  const [, pos, db] = map.beats[i]!;
  const start = f.beats[i]!;
  const length = Math.max(1, (f.beats[i + 1] ?? start + period) - start);
  const since = frame - start;
  return {
    index: i,
    pos,
    bar: f.bars[i]!,
    since,
    length,
    progress: Math.min(1, since / length),
    db,
    isDownbeat: pos === 1,
  };
}

export type BeatUnit = "beat" | "bar";

/**
 * Frames of the music's beats, bars and sections, for placing things on them: `<Sequence from>`,
 * `durationInFrames`, markers, animation delays. From `useBeatGrid()` every frame is in the
 * current `<Sequence>`'s time (what `useCurrentFrame()` counts); from `beatGrid()` it is the
 * composition's.
 *
 * Beats and bars past either end of the beat map are extrapolated at `bpm` and `meter`, so
 * `bar(barCount)` is where the last bar ends.
 */
export interface BeatGrid {
  /** Frame of beat `index` (an index into `map.beats`). */
  beat(index: number): number;
  /**
   * Frame of bar `bar` (0 = the first downbeat), at beat `pos` of it (1-based, default 1). A `pos`
   * past the bar's end continues into the next bars: `bar(4, 5)` in 4/4 is `bar(5)`.
   */
  bar(bar: number, pos?: number): number;
  /** Frame where section `index` starts: 0 is the audio's start, 1 the first boundary. */
  section(index: number): number;
  /** Frame showing `seconds` into the audio file (narration cues, a hand-picked moment). */
  time(seconds: number): number;
  /** The last beat (or downbeat) at or before `frame`. */
  prev(frame: number, unit?: BeatUnit): number;
  /** The first beat (or downbeat) at or after `frame`. */
  next(frame: number, unit?: BeatUnit): number;
  /** The nearest beat (or downbeat); a tie goes to the earlier one. */
  snap(frame: number, unit?: BeatUnit): number;
  /** The beat at `frame`, as `useBeat()` returns it. */
  at(frame: number): BeatState;
  /** Bars starting in the beat map (from the first downbeat on). */
  readonly barCount: number;
  /** Sections, counting the one before the first boundary: `section(sectionCount - 1)` is the last. */
  readonly sectionCount: number;
}

/** Largest k with at(k) ≤ frame, for a strictly increasing `at` whose real range is [0, n). */
function lastIndex(at: (k: number) => number, frame: number, n: number): number {
  if (n === 0 || at(0) > frame) {
    let k = -1;
    while (at(k) > frame) {
      k--;
    }
    return k;
  }
  if (at(n - 1) <= frame) {
    let k = n - 1;
    while (at(k + 1) <= frame) {
      k++;
    }
    return k;
  }
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (at(mid) <= frame) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

function makeGrid(map: BeatMap, fps: number, offset: number, shift: number): BeatGrid {
  const f = framesOf(map, fps, offset);
  const n = map.beats.length;
  const period = 60 / map.bpm;
  const meter = Math.max(1, map.meter);
  const downs: number[] = [];
  map.beats.forEach(([, pos], i) => {
    if (pos === 1) {
      downs.push(i);
    }
  });
  const beatAbs = (i: number): number => {
    if (i >= 0 && i < n) {
      return f.beats[i]!;
    }
    if (n === 0) {
      return timeToFrame(i * period, fps, offset);
    }
    const t = i < 0 ? map.beats[0]![0]! + i * period : map.beats[n - 1]![0]! + (i - n + 1) * period;
    return timeToFrame(t, fps, offset);
  };
  const downIndex = (k: number): number => {
    if (downs.length === 0) {
      return k * meter;
    }
    if (k < 0) {
      return downs[0]! + k * meter;
    }
    return k < downs.length ? downs[k]! : downs[downs.length - 1]! + (k - downs.length + 1) * meter;
  };
  const barAbs = (k: number): number => beatAbs(downIndex(k));
  const pick = (unit: BeatUnit) => (unit === "bar" ? ([barAbs, downs.length] as const) : ([beatAbs, n] as const));
  const prevAbs = (frame: number, unit: BeatUnit) => {
    const [at, count] = pick(unit);
    return at(lastIndex(at, Math.floor(frame), count));
  };
  const nextAbs = (frame: number, unit: BeatUnit) => {
    const [at, count] = pick(unit);
    return at(lastIndex(at, Math.ceil(frame) - 1, count) + 1);
  };
  return {
    beat: (index) => beatAbs(index) - shift,
    bar: (bar, pos = 1) => beatAbs(downIndex(bar) + pos - 1) - shift,
    section: (index) => {
      if (index === 0) {
        return timeToFrame(0, fps, offset) - shift;
      }
      const t = map.sections[index - 1];
      if (t === undefined) {
        throw new RangeError(`section(${index}): the beat map has sections 0..${map.sections.length}`);
      }
      return f.sections[index - 1]! - shift;
    },
    time: (seconds) => timeToFrame(seconds, fps, offset) - shift,
    prev: (frame, unit = "beat") => prevAbs(frame + shift, unit) - shift,
    next: (frame, unit = "beat") => nextAbs(frame + shift, unit) - shift,
    snap: (frame, unit = "beat") => {
      const a = prevAbs(frame + shift, unit);
      const b = nextAbs(frame + shift, unit);
      return (frame + shift - a <= b - frame - shift ? a : b) - shift;
    },
    at: (frame) => beatAt(map, frame + shift, fps, offset),
    barCount: downs.length,
    sectionCount: map.sections.length + 1,
  };
}

/**
 * The beat grid in composition frames. Usable outside components, e.g. for `durationInFrames`
 * and `markers` in `defineComposition`. Pass the same `offset` as the composition's `audio`.
 *
 *   const grid = beatGrid(beats, { fps: 30, offset: -0.26 });
 *   durationInFrames: grid.bar(grid.barCount),
 */
export function beatGrid(map: BeatMap, options: { fps: number; offset?: number }): BeatGrid {
  return makeGrid(map, options.fps, options.offset ?? 0, 0);
}

/**
 * The beat grid in the current `<Sequence>`'s time, so its frames go straight into a nested
 * `<Sequence from>` or an animation's `delay`.
 *
 *   const grid = useBeatGrid(beats);
 *   <Sequence from={grid.section(1)}>…</Sequence>
 */
export function useBeatGrid(map: BeatMap, options?: BeatOptions): BeatGrid {
  const timeline = useTimelineFrame();
  const local = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fallback = useAudioOffset();
  return makeGrid(map, fps, options?.offset ?? fallback, timeline - local);
}

function useTiming(options?: BeatOptions) {
  const frame = useTimelineFrame();
  const { fps } = useVideoConfig();
  const fallback = useAudioOffset();
  return { frame, fps, offset: options?.offset ?? fallback };
}

/**
 * The current beat. Follows the composition's timeline (and its audio), not `<Sequence>` time.
 *
 *   const b = useBeat(beats);
 *   const k = decay(b.since, fps) * (b.isDownbeat ? 1 : 0.5);
 */
export function useBeat(map: BeatMap, options?: BeatOptions): BeatState {
  const { frame, fps, offset } = useTiming(options);
  return beatAt(map, frame, fps, offset);
}

/** Current section: index (0 before the first boundary) and frames since it started. */
export function useSection(map: BeatMap, options?: BeatOptions): { index: number; since: number } {
  const { frame, fps, offset } = useTiming(options);
  const f = framesOf(map, fps, offset);
  const i = lastAtOrBefore(f.sections, frame);
  return { index: i + 1, since: i < 0 ? frame : frame - f.sections[i]! };
}

/**
 * The most recent onset at or above `minStrength` (default 0.4): frames since it (Infinity
 * before the first) and its strength.
 */
export function useOnset(
  map: BeatMap,
  options?: BeatOptions & { minStrength?: number },
): { since: number; strength: number } {
  const { frame, fps, offset } = useTiming(options);
  const min = options?.minStrength ?? 0.4;
  const f = framesOf(map, fps, offset);
  let i = lastAtOrBefore(f.onsets, frame);
  while (i >= 0 && map.onsets[i]![1] < min) {
    i--;
  }
  return i < 0 ? { since: Infinity, strength: 0 } : { since: frame - f.onsets[i]!, strength: map.onsets[i]![1] };
}

/**
 * 1 where the music marks the beat clearly, 0 inside `lowConfidence` stretches, ramping over
 * `fade` seconds (default 0.5). Multiply hit sizes by it so unclear passages get soft motion.
 */
export function useBeatConfidence(map: BeatMap, options?: BeatOptions & { fade?: number }): number {
  const { frame, fps, offset } = useTiming(options);
  const fade = options?.fade ?? 0.5;
  const t = frame / fps - offset;
  let c = 1;
  for (const [s, e] of map.lowConfidence ?? []) {
    const inside = Math.min(t - s, e - t);
    c = Math.min(c, inside >= 0 ? 0 : inside <= -fade ? 1 : -inside / fade);
  }
  return c;
}

/** The tempo segment at the current frame: its BPM (null in free time) and index. */
export function useTempo(map: BeatMap, options?: BeatOptions): { bpm: number | null; free: boolean; index: number } {
  const { frame, fps, offset } = useTiming(options);
  const t = frame / fps - offset;
  const segs = map.tempo?.length ? map.tempo : [{ start: 0, bpm: map.bpm, free: false }];
  let i = 0;
  while (i + 1 < segs.length && segs[i + 1]!.start <= t) {
    i++;
  }
  return { bpm: segs[i]!.bpm, free: segs[i]!.free, index: i };
}

/**
 * 1 on a hit's frame (`since` = 0), halving every `halfLife` seconds (default 0.08), so the feel
 * doesn't change with fps. Snaps to 0 below 0.02 and before the hit, which keeps idle frames free
 * of keyframes.
 */
export function decay(since: number, fps: number, halfLife = 0.08): number {
  if (since < 0 || !Number.isFinite(since)) {
    return 0;
  }
  const v = Math.pow(0.5, since / fps / halfLife);
  return v < 0.02 ? 0 : v;
}
