import { describe, expect, it } from "vite-plus/test";

import { all, render } from "../testing.js";
import { Sequence, type VideoConfig } from "../timeline.js";
import {
  beatAt,
  beatGrid,
  decay,
  timeToFrame,
  useBeat,
  useBeatConfidence,
  useBeatGrid,
  useOnset,
  useSection,
  useTempo,
  type BeatMap,
} from "./beats.js";

// 120 BPM, 4/4, first downbeat at 0.5 s; a tempo change to 150 BPM at 4.5 s.
const MAP: BeatMap = {
  bpm: 120,
  meter: 4,
  beats: [
    [0.5, 1, -1],
    [1.0, 2, -3],
    [1.5, 3, -2],
    [2.0, 4, -3],
    [2.5, 1, 0],
    [3.0, 2, -3],
    [3.5, 3, -2],
    [4.0, 4, -3],
    [4.5, 1, -1],
    [4.9, 2, -3],
  ],
  sections: [2.5],
  onsets: [
    [0.5, 0.9],
    [0.75, 0.2],
    [1.0, 0.6],
  ],
  lowConfidence: [[3, 4]],
  tempo: [
    { start: 0, bpm: 120, free: false },
    { start: 4.5, bpm: 150, free: false },
  ],
};

const CONFIG: VideoConfig = { width: 100, height: 100, fps: 30, durationInFrames: 300 };

/** Renders a probe that prints a hook's result as JSON. */
function probe(hook: () => unknown, frame: number, config: VideoConfig = CONFIG): unknown {
  function Probe() {
    return <text>{JSON.stringify(hook())}</text>;
  }
  const [root] = render(<Probe />, { frame, config });
  const text = root!.children[0] as unknown as { data: string };
  return JSON.parse(text.data);
}

describe("timeToFrame", () => {
  it("rounds down so hits are never late", () => {
    expect(timeToFrame(0.5, 30)).toBe(15);
    expect(timeToFrame(0.51, 30)).toBe(15);
    expect(timeToFrame(0.533, 30)).toBe(15);
    expect(timeToFrame(0.534, 30)).toBe(16);
  });

  it("applies the offset in seconds", () => {
    expect(timeToFrame(0.5, 30, 1)).toBe(45);
    expect(timeToFrame(10, 30, -10)).toBe(0);
  });
});

describe("beatAt", () => {
  it("is empty before the first beat", () => {
    expect(beatAt(MAP, 10, 30)).toMatchObject({ index: -1, pos: 0, bar: -1 });
  });

  it("reports position, bar and timing within a beat", () => {
    expect(beatAt(MAP, 15, 30)).toMatchObject({ index: 0, pos: 1, bar: 0, since: 0, length: 15, isDownbeat: true });
    expect(beatAt(MAP, 20, 30)).toMatchObject({ index: 0, since: 5 });
    expect(beatAt(MAP, 20, 30).progress).toBeCloseTo(1 / 3);
    expect(beatAt(MAP, 75, 30)).toMatchObject({ index: 4, pos: 1, bar: 1, db: 0 });
  });

  it("follows uneven beats and counts bars by downbeats", () => {
    // 4.5 → 4.9 s is 12 frames (135 → 147).
    expect(beatAt(MAP, 140, 30)).toMatchObject({ index: 8, bar: 2, length: 12, since: 5 });
    const additive: BeatMap = {
      ...MAP,
      beats: [
        [0, 1, 0],
        [0.3, 2, 0],
        [0.5, 1, 0],
        [0.8, 2, 0],
        [1.0, 1, 0],
      ],
    };
    expect(beatAt(additive, 24, 30)).toMatchObject({ pos: 2, bar: 1 });
    expect(beatAt(additive, 30, 30)).toMatchObject({ pos: 1, bar: 2 });
  });

  it("uses bpm for the last beat's length", () => {
    expect(beatAt(MAP, 150, 30)).toMatchObject({ index: 9, length: 15 });
  });
});

describe("beatGrid", () => {
  // Beat frames at 30 fps: 15 30 45 60 | 75 90 105 120 | 135 147; downbeats 15, 75, 135.
  const grid = beatGrid(MAP, { fps: 30 });

  it("gives frames of beats, bars and sections", () => {
    expect(grid.beat(2)).toBe(45);
    expect(grid.bar(1)).toBe(75);
    expect(grid.bar(1, 3)).toBe(105);
    expect(grid.bar(0, 5)).toBe(75);
    expect(grid.section(0)).toBe(0);
    expect(grid.section(1)).toBe(75);
    expect(() => grid.section(2)).toThrow(RangeError);
    expect(grid.time(1)).toBe(30);
    expect([grid.barCount, grid.sectionCount]).toEqual([3, 2]);
  });

  it("extrapolates past both ends at bpm and meter", () => {
    // bar 3 is beat 12: the last beat (4.9 s) plus 3 beats of 0.5 s.
    expect(grid.bar(3)).toBe(192);
    expect(grid.bar(-1)).toBe(-45);
    expect(grid.beat(-1)).toBe(0);
  });

  it("finds the previous, next and nearest beat", () => {
    expect(grid.prev(50)).toBe(45);
    expect(grid.next(50)).toBe(60);
    expect(grid.next(60)).toBe(60);
    expect(grid.snap(52)).toBe(45);
    expect(grid.snap(53)).toBe(60);
    expect(grid.prev(50, "bar")).toBe(15);
    expect(grid.next(76, "bar")).toBe(135);
    expect(grid.next(140, "bar")).toBe(192);
    expect(grid.prev(5)).toBe(0);
  });

  it("applies the offset and answers at()", () => {
    expect(beatGrid(MAP, { fps: 30, offset: 1 }).bar(1)).toBe(105);
    expect(grid.at(80)).toMatchObject({ index: 4, bar: 1, since: 5 });
  });

  it("useBeatGrid counts in the current <Sequence>'s time", () => {
    function Probe() {
      const g = useBeatGrid(MAP);
      return <text>{JSON.stringify([g.bar(1), g.snap(16), g.at(15).index])}</text>;
    }
    const withAudio = { ...CONFIG, audio: { src: "a.mp3", offset: 1 } } as VideoConfig;
    const [root] = render(
      <g>
        <Sequence from={60}>
          <Probe />
        </Sequence>
      </g>,
      { frame: 70, config: withAudio },
    );
    // With the 1 s offset bar 1 is composition frame 105, so 45 in the Sequence; beats at
    // composition 75 and 90 are local 15 and 30; local 15 is beat 2 (composition 75).
    const [text] = all(root!, "text");
    expect(JSON.parse((text!.children[0] as unknown as { data: string }).data)).toEqual([45, 15, 2]);
  });
});

describe("hooks", () => {
  it("useBeat applies the composition's audio offset", () => {
    const withAudio = { ...CONFIG, audio: { src: "a.mp3", offset: 1 } } as VideoConfig;
    expect(probe(() => useBeat(MAP).index, 15, withAudio)).toBe(-1);
    expect(probe(() => useBeat(MAP).index, 45, withAudio)).toBe(0);
    expect(probe(() => useBeat(MAP, { offset: 0 }).index, 15, withAudio)).toBe(0);
  });

  it("useBeat follows the composition timeline inside <Sequence>", () => {
    function Probe() {
      return <text>{useBeat(MAP).index}</text>;
    }
    const [root] = render(
      <g>
        <Sequence from={60}>
          <Probe />
        </Sequence>
      </g>,
      { frame: 15, config: CONFIG },
    );
    // Sequence-local frame is -45; the timeline frame (15) is the first beat.
    const [text] = all(root!, "text");
    expect((text!.children[0] as unknown as { data: string }).data).toBe("0");
  });

  it("useSection counts boundaries", () => {
    expect(probe(() => useSection(MAP), 30)).toEqual({ index: 0, since: 30 });
    expect(probe(() => useSection(MAP), 80)).toEqual({ index: 1, since: 5 });
  });

  it("useOnset skips weak onsets", () => {
    expect(probe(() => useOnset(MAP), 10)).toEqual({ since: null, strength: 0 });
    expect(probe(() => useOnset(MAP), 25)).toEqual({ since: 10, strength: 0.9 });
    expect(probe(() => useOnset(MAP, { minStrength: 0.1 }), 25)).toEqual({ since: 3, strength: 0.2 });
  });

  it("useBeatConfidence ramps around low-confidence stretches", () => {
    expect(probe(() => useBeatConfidence(MAP), 60)).toBe(1);
    expect(probe(() => useBeatConfidence(MAP), 105)).toBe(0);
    expect(probe(() => useBeatConfidence(MAP), 83)).toBeCloseTo(0.5, 1);
  });

  it("useTempo picks the segment", () => {
    expect(probe(() => useTempo(MAP), 30)).toEqual({ bpm: 120, free: false, index: 0 });
    expect(probe(() => useTempo(MAP), 140)).toEqual({ bpm: 150, free: false, index: 1 });
  });
});

describe("decay", () => {
  it("halves every halfLife seconds and snaps to 0", () => {
    expect(decay(0, 30)).toBe(1);
    expect(decay(3, 30, 0.1)).toBeCloseTo(0.5);
    expect(decay(-1, 30)).toBe(0);
    expect(decay(Infinity, 30)).toBe(0);
    expect(decay(300, 30)).toBe(0);
  });
});
