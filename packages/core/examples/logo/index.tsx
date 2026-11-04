// svgreel logo: a film reel that rests, spins up and settles with a pulse of its play mark (it
// loops), next to an italic wordmark that rises in once and stays (<Once>).

import {
  defineComposition,
  defineVariants,
  Easing,
  fontsource,
  interpolate,
  measureText,
  Once,
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
const FONT = { family: "Figtree", weight: 600, size: 76 };
const MARK_X = 92;
const CY = 84;
const WORD_X = 190;
/** Fonts aren't registered yet when this module loads, so the width is fixed by hand: WORD_X + wordmark + margin. */
const W = 480;
const H = 168;

const io = Easing.inOut(Easing.cubic);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Five holes on a circle of radius `at`. With five-fold symmetry, any turn by a multiple of 72° looks like no turn. */
const holes = (at: number) =>
  [0, 1, 2, 3, 4].map((i) => {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    return { cx: round(Math.cos(a) * at, 2), cy: round(Math.sin(a) * at, 2) };
  });

/** Play triangle with its centroid at (0, 0), `s` = half height. */
const play = (s: number) => {
  const w = s * 1.85;
  return `M${round(-w / 3, 2)} ${-s} L${round((w * 2) / 3, 2)} 0 L${round(-w / 3, 2)} ${s} Z`;
};

/** Rest, spin up 1.2 turns, settle, then the play mark pulses once. */
function useReel() {
  const f = useCurrentFrame();
  return {
    turn: interpolate(f, [8, 52], [0, 432], { easing: io, ...clamp }),
    pulse: interpolate(f, [52, 60, 74], [0, 1, 0], clamp),
  };
}

/** In a 28-radius disc: hole ring radius, hole radius, play-mark half height. */
const HOLE_AT = 18;
const HOLE_R = 5.5;
const PLAY_S = 7;

/** Orange disc with five holes cut through, play mark at the hub. */
function ReelMark() {
  const id = useSvgId("reel");
  const { turn, pulse } = useReel();
  return (
    <>
      <mask id={id}>
        <circle r={28} fill="#fff" />
        {holes(HOLE_AT).map((h, i) => (
          <circle key={i} cx={h.cx} cy={h.cy} r={HOLE_R} fill="#000" />
        ))}
      </mask>
      <g style={{ transform: `rotate(${round(turn, 3)}deg)` }}>
        <circle r={28} fill={ORANGE} mask={`url(#${id})`} />
      </g>
      <g style={{ transform: `scale(${round(1 + 0.2 * pulse, 3)})` }}>
        <path d={play(PLAY_S)} fill="#fff" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
      </g>
    </>
  );
}

const variants = defineVariants({ theme: ["light", "dark"] });
const TEXT = { light: "#1f2328", dark: "#e6edf3" };

function Wordmark() {
  const { theme } = useVariant<typeof variants>();
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
  const baseline = CY + 27;
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
  return (
    <svg viewBox={`0 0 ${W} ${H}`}>
      <g transform={`translate(${MARK_X} ${CY}) scale(2.2)`}>
        <ReelMark />
      </g>
      <Wordmark />
    </svg>
  );
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
