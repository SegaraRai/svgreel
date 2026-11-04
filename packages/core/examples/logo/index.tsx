// svgreel logo: a film reel that rests, spins up and settles with a pulse of its play mark (it
// loops), next to an italic wordmark that rises in once and stays (<Once>).
// motion "intro": the reel grows out of nothing, then the wordmark is pulled out of its edge like
// film, the reel rolling with it. Plays once and holds.

import {
  defineComposition,
  defineVariants,
  Easing,
  fontsource,
  interpolate,
  measureText,
  Once,
  Reveal,
  round,
  spring,
  Text,
  useCurrentFrame,
  useSvgId,
  useVariant,
  useVideoConfig,
  type CharInfo,
} from "svgreel";

const ORANGE = "#F7931E";
const N = 120;
const FONT = { family: "Figtree", weight: 600, size: 100 };
const MARK_X = 92;
const CY = 84;
const WORD_X = 186;
/** Centers the x-height (about half an em) on the reel. */
const BASELINE = CY + 25;
/** Fonts aren't registered yet when this module loads, so the width is fixed by hand: WORD_X + wordmark + margin. */
const W = 548;
const H = 168;

const io = Easing.inOut(Easing.cubic);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Five holes on a circle of radius `at`, turned to the rest angle. With five-fold symmetry, any
 * turn by a multiple of 72° looks like no turn.
 */
const holes = (at: number) =>
  [0, 1, 2, 3, 4].map((i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2 + (REST * Math.PI) / 180;
    return { cx: round(Math.cos(a) * at, 2), cy: round(Math.sin(a) * at, 2) };
  });

/** Play triangle with its centroid at (0, 0), `s` = half height. */
const play = (s: number) => {
  const w = s * 1.85;
  return `M${round(-w / 3, 2)} ${-s} L${round((w * 2) / 3, 2)} 0 L${round(-w / 3, 2)} ${s} Z`;
};

const variants = defineVariants({
  theme: ["light", "dark"],
  motion: ["default", "still", "intro"],
});

/** Reel radius in the logo's units (28 × the mark's 2.2 scale), and where its right edge is. */
const REEL_R = 28 * 2.2;
const REEL_EDGE = MARK_X + REEL_R;
/** The wordmark slides out from behind the reel's edge across the rest of the width. */
const PULL_W = W - REEL_EDGE;
/** Degrees the reel rolls while the wordmark is pulled out of it. */
const ROLL = (PULL_W / REEL_R) * (180 / Math.PI);
/**
 * Rest angle of the holes: where the intro's roll leaves them. Baked into the hole positions so
 * every variant rests at rotate(0) and ends in the same pose.
 */
const REST = ROLL % 72;

/** Intro: the reel is born (0–24), the wordmark is pulled out (20–60), the play mark pulses. */
function useIntro() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const born = spring({ frame: f, fps, config: { damping: 11, mass: 0.7 } });
  const pull = interpolate(f, [20, 60], [0, 1], { easing: Easing.out(Easing.cubic), ...clamp });
  return {
    grow: born,
    hub: spring({ frame: f - 8, fps, config: { damping: 10, mass: 0.5 } }),
    pull,
    // Rolls with the film (arc length pulled / radius), plus a quarter turn while it is born. Ends
    // at ROLL - REST, a multiple of 72°, so the holes rest at REST like the other variants.
    turn: (born - 1) * 90 + pull * ROLL - REST,
    pulse: interpolate(f, [60, 68, 82], [0, 1, 0], clamp),
  };
}

/** Rest, spin up 1.2 turns, settle, then the play mark pulses once. */
function useReel() {
  const f = useCurrentFrame();
  const intro = useIntro();
  if (useVariant<typeof variants>().motion === "intro") {
    return intro;
  }
  return {
    grow: 1,
    hub: 1,
    pull: 1,
    turn: interpolate(f, [8, 52], [0, 432], { easing: io, ...clamp }),
    pulse: interpolate(f, [52, 60, 74], [0, 1, 0], clamp),
  };
}

/** In a 28-radius disc: hole ring radius, hole radius, play-mark half height. */
const HOLE_AT = 19.5;
const HOLE_R = 5.5;
const PLAY_S = 7;

/** Orange disc with five holes cut through, play mark at the hub. */
function ReelMark() {
  const id = useSvgId("reel");
  const { grow, hub, turn, pulse } = useReel();
  return (
    <g style={{ transform: `scale(${round(Math.max(0, grow), 3)})` }}>
      <mask id={id}>
        <circle r={28} fill="#fff" />
        {holes(HOLE_AT).map((h, i) => (
          <circle key={i} cx={h.cx} cy={h.cy} r={HOLE_R} fill="#000" />
        ))}
      </mask>
      <g style={{ transform: `rotate(${round(turn, 3)}deg)` }}>
        <circle r={28} fill={ORANGE} mask={`url(#${id})`} />
      </g>
      <g style={{ transform: `scale(${round(Math.max(0, hub) + 0.2 * pulse, 3)})` }}>
        <path d={play(PLAY_S)} fill="#fff" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
      </g>
    </g>
  );
}

const TEXT = { light: "#1f2328", dark: "#e6edf3" };

/** Intro: the wordmark slides out from behind the reel's right edge, no per-letter rise. */
function PulledWordmark() {
  const { theme } = useVariant<typeof variants>();
  const { pull } = useReel();
  const svgW = measureText("svg", FONT);
  const x = WORD_X - REEL_EDGE;
  const y = BASELINE;
  return (
    <Reveal x={REEL_EDGE} y={0} width={PULL_W} height={H} progress={pull} direction="right">
      <Text x={x} y={y} {...FONT} fill={TEXT[theme]}>
        svg
      </Text>
      <Text x={x + svgW + 1} y={y} {...FONT} fill={ORANGE}>
        reel
      </Text>
    </Reveal>
  );
}

function Wordmark() {
  const { theme, motion } = useVariant<typeof variants>();
  if (motion === "intro") {
    return <PulledWordmark />;
  }
  const text = TEXT[theme];
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const svgW = measureText("svg", FONT);
  const rise = (index: number) => {
    const s = spring({ frame: f - 4 - index * 2.5, fps, config: { damping: 13, mass: 0.6 } });
    return {
      opacity: round(Math.min(1, s * 1.6), 3),
      transform: `translate(${round((1 - s) * -10, 3)}px, ${round((1 - s) * 26, 3)}px)`,
    };
  };
  const baseline = BASELINE;
  return (
    <Once>
      <Text x={WORD_X} y={baseline} {...FONT} fill={text} charStyle={({ index }: CharInfo) => rise(index)}>
        svg
      </Text>
      <Text
        x={WORD_X + svgW + 1}
        y={baseline}
        {...FONT}
        fill={ORANGE}
        charStyle={({ index }: CharInfo) => rise(index + 3)}
      >
        reel
      </Text>
    </Once>
  );
}

function Logo() {
  const { motion } = useVariant<typeof variants>();
  const content = (
    <>
      <Wordmark />
      <g transform={`translate(${MARK_X} ${CY}) scale(2.2)`}>
        <ReelMark />
      </g>
    </>
  );
  return <svg viewBox={`0 0 ${W} ${H}`}>{motion === "intro" ? <Once>{content}</Once> : content}</svg>;
}

export default defineComposition({
  component: Logo,
  width: W,
  height: H,
  fps: 30,
  durationInFrames: N,
  stillFrame: N - 1,
  variants,
  fonts: fontsource("figtree", { family: "Figtree", weights: [600], italic: true }),
  title: "svgreel",
});
