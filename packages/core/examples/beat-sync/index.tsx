// Scenes and text timed to music. music.mp3 (synthesized by music.py, CC0) was analyzed with
// `uv run tools/beatmap.py analyze music.mp3 -o music.analysis.json` and exported to beats.json.
// The analysis put the section start at bar 8: an 8-bar track has too few bars for section
// clustering, so "sections" was set to bar 5 (the 5th downbeat) by hand.
//
// The scenes cut on the section start, words land on beats, and the kick circle pulses on every
// beat. The preview plays the audio in sync (tick "sound"); the SVG itself is silent. See
// docs/audio.md.

import {
  beatGrid,
  charAnimations,
  decay,
  defineComposition,
  fontsource,
  mixColors,
  round,
  Sequence,
  Text,
  useBeat,
  useBeatGrid,
  useCurrentFrame,
  useOnset,
  useSection,
  useVideoConfig,
  type BeatMap,
} from "svgreel";

import beatsJson from "./beats.json" with { type: "json" };

const beats: BeatMap = beatsJson;
const W = 800;
const H = 400;
const FPS = 30;
/** The file's first downbeat is at 0.26 s; start the timeline there so the 8 bars loop cleanly. */
const OFFSET = -beats.beats[0]![0]!;
/** Composition frames of the music, for the timeline below and the composition's settings. */
const grid = beatGrid(beats, { fps: FPS, offset: OFFSET });
const BARS = 8;
const N = grid.bar(BARS);
const DROP = grid.section(1);
const SANS = "Inter";

const C = {
  bg: ["#0d1220", "#1a1130"],
  panel: "#161d2e",
  text: "#e6edf3",
  muted: "#7d8799",
  dim: "#273047",
  beat: "#7aa2ff",
  down: "#ffb35c",
  snare: "#7ee2a8",
};

function Kick() {
  const { fps } = useVideoConfig();
  const b = useBeat(beats);
  // Downbeats hit harder and ring longer than the other beats.
  const k = b.index < 0 ? 0 : decay(b.since, fps, b.isDownbeat ? 0.12 : 0.07) * (b.isDownbeat ? 1 : 0.5);
  const fill = mixColors(C.dim, b.isDownbeat ? C.down : C.beat, round(k, 2));
  return (
    <g transform="translate(200 190)">
      <circle r={80} fill={fill} style={{ transform: `scale(${round(1 + 0.22 * k, 3)})` }} />
    </g>
  );
}

function SnareRing() {
  const { fps } = useVideoConfig();
  const o = useOnset(beats, { minStrength: 0.5 });
  const t = Math.min(1, o.since / (0.3 * fps));
  return (
    <circle
      cx={200}
      cy={190}
      r={90}
      fill="none"
      stroke={C.snare}
      strokeWidth={3}
      opacity={round((1 - t) * 0.8, 2)}
      style={{ transform: `scale(${round(1 + 0.5 * t, 3)})`, transformOrigin: "200px 190px" }}
    />
  );
}

/** `pop` reaches full size 0.23 s after it starts; start that much early so words land on the beat. */
const LAND = Math.round(0.23 * FPS);
/**
 * The first word has no rhythm before it to be judged against, so an early start reads as early:
 * give it a shorter lead (it is already fully opaque, and 70 % grown, on the beat).
 */
const FIRST_LAND = Math.round(0.13 * FPS);

/** Scene 1: one word per beat of bar 2. */
function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const g = useBeatGrid(beats);
  const words = ["Words", "land", "on", "beats"];
  return (
    <g>
      {words.map((w, i) => (
        <Text
          key={w}
          x={380}
          y={120 + i * 44}
          family={SANS}
          weight={800}
          size={36}
          fill={i === 0 ? C.down : C.text}
          charStyle={charAnimations.pop({
            frame,
            fps,
            delay: g.bar(1, i + 1) - (i === 0 ? FIRST_LAND : LAND),
            stagger: 0,
          })}
        >
          {w}
        </Text>
      ))}
    </g>
  );
}

/** Scene 2: from the section start. Its frames count from the cut, and so does the grid. */
function Drop() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const g = useBeatGrid(beats);
  return (
    <g>
      <Text
        x={380}
        y={150}
        family={SANS}
        weight={800}
        size={44}
        fill={C.text}
        charStyle={charAnimations.rise({ frame, fps, stagger: 1 })}
      >
        New section
      </Text>
      <Text
        x={380}
        y={190}
        family={SANS}
        size={18}
        fill={C.muted}
        charStyle={charAnimations.fade({ frame, fps, delay: g.bar(5), stagger: 1 })}
      >
        cut on the music's section start
      </Text>
      <Steps />
    </g>
  );
}

/** Eight steps per bar: the lit cell walks in eighth notes. */
function Steps() {
  const { fps } = useVideoConfig();
  const b = useBeat(beats);
  const step = b.index < 0 ? -1 : (b.pos - 1) * 2 + (b.progress >= 0.5 ? 1 : 0);
  const since = b.progress >= 0.5 ? b.since - Math.ceil(b.length / 2) : b.since;
  return (
    <g transform="translate(380 230)">
      {Array.from({ length: 8 }, (_, i) => {
        const on = i === step;
        const k = on ? 0.4 + 0.6 * decay(since, fps, 0.1) : 0;
        return (
          <rect
            key={i}
            x={i * 40}
            y={0}
            width={32}
            height={32}
            rx={6}
            fill={mixColors(C.panel, i % 2 ? C.muted : i === 0 ? C.down : C.beat, round(k, 2))}
          />
        );
      })}
    </g>
  );
}

/** Which of the 8 bars is playing. */
function Bars() {
  const b = useBeat(beats);
  return (
    <g transform="translate(380 330)">
      {Array.from({ length: BARS }, (_, i) => (
        <rect key={i} x={i * 40} y={0} width={32} height={6} rx={3} fill={i <= b.bar ? C.muted : C.dim} />
      ))}
    </g>
  );
}

function BeatSync() {
  const { fps } = useVideoConfig();
  const s = useSection(beats);
  const flash = s.index > 0 ? decay(s.since, fps, 0.2) : 0;
  const bg = mixColors(C.bg[Math.min(1, s.index)]!, "#ffffff", round(flash * 0.2, 2));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect width={W} height={H} rx={16} fill={bg} />
      <SnareRing />
      <Kick />
      <Sequence durationInFrames={DROP}>
        <Intro />
      </Sequence>
      <Sequence from={DROP}>
        <Drop />
      </Sequence>
      <Bars />
      <Text x={380} y={364} family={SANS} size={13} fill={C.muted}>
        {`${round(beats.bpm)} BPM · ${beats.meter}/4 · 8 bars`}
      </Text>
    </svg>
  );
}

export default defineComposition({
  component: BeatSync,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: N,
  stillFrame: grid.bar(6),
  title: "Beat-synced motion demo",
  audio: { src: "music.mp3", offset: OFFSET },
  markers: [
    { frame: 0, label: "intro" },
    { frame: DROP, label: "section 2" },
  ],
  fonts: [...fontsource("inter", { family: SANS, weights: [400, 800] })],
});
