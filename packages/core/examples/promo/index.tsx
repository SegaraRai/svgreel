// svgreel's own promo: intro → write (React code) → compile (frames → CSS keyframes) → features →
// outro (terminal + logo), 20 s looping, in dark and light, in the languages of content.ts (LANGS).
// Decided: 1200 × 600 README header, 5 scenes of 4 s, logo orange (#F7931E) as the accent,
// Figtree + JetBrains Mono, plus a Noto font or Inter per language for its script (SCRIPT_FONTS).
// Text lives in content.ts; lines that vary in length shrink to fit (fit()).
// The still file shows an overview: logo, tagline and the four feature cards.

import { createContext, useContext, type ReactNode } from "react";
import {
  Appear,
  charAnimations,
  CodeBlock,
  defineComposition,
  defineVariants,
  DotGrid,
  DrawPath,
  Easing,
  fitFontSize,
  fontsource,
  GlowOrb,
  measureText,
  oscillate,
  PillRow,
  pillWidth,
  ProgressBar,
  pulse,
  round,
  Sequence,
  spring,
  Terminal,
  Text,
  tween,
  useCurrentFrame,
  useSvgId,
  useVariant,
  useVideoConfig,
  Wipe,
  type CharInfo,
  type CodeTheme,
  type TextStyle,
} from "svgreel";

import { code, copy, css, formula, LANGS, repo, terminal, type Copy, type Feature, type Lang } from "./content.js";

const W = 1200;
const H = 600;
const FPS = 30;
const SCENE = 120;
const SCENES = ["intro", "write", "compile", "features", "outro"] as const;
const N = SCENE * SCENES.length;
const sceneStart = (name: (typeof SCENES)[number]) => SCENES.indexOf(name) * SCENE;
/** Frames of the loop-seam wipe that fall before the loop point. */
const SEAM = 11;

const SANS = "Figtree";
const WORDMARK = "Figtree Italic";
const MONO = "JetBrains Mono";
const ORANGE = "#F7931E";

interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  dim: string;
  /** Orange for small text, darker on light backgrounds for contrast. */
  accentText: string;
  flash: string;
  orb: number;
  code: CodeTheme;
}

const THEMES = {
  dark: {
    dark: true,
    bg: "#0d1117",
    surface: "#151b24",
    border: "#262e3a",
    text: "#e6edf3",
    muted: "#8b95a5",
    dim: "#323b48",
    accentText: ORANGE,
    flash: "#ffffff",
    orb: 0.28,
    code: {
      background: "#151b24",
      header: "#1b2230",
      border: "#262e3a",
      text: "#e6edf3",
      comment: "#5b6575",
      string: "#a5d6a7",
      keyword: ORANGE,
      number: "#7dd3fc",
      tag: "#7dd3fc",
      accent: ORANGE,
    },
  },
  light: {
    dark: false,
    bg: "#ffffff",
    surface: "#f6f8fa",
    border: "#d0d7de",
    text: "#1f2328",
    muted: "#59636e",
    dim: "#d5dbe1",
    accentText: "#b85c00",
    flash: "#1f2328",
    orb: 0.16,
    code: {
      background: "#f6f8fa",
      header: "#eef1f5",
      border: "#d0d7de",
      text: "#1f2328",
      comment: "#8c959f",
      string: "#1a7f37",
      keyword: "#b85c00",
      number: "#0550ae",
      tag: "#0550ae",
      accent: "#b85c00",
    },
  },
} satisfies Record<string, Theme>;

const variants = defineVariants({ theme: ["dark", "light"], lang: LANGS });

/**
 * Families tried after Figtree / JetBrains Mono for each language's own script. Han characters
 * look different in Japanese, Simplified and Traditional Chinese, so each gets its own Noto font
 * ahead of the global fallback (Noto Sans JP). Figtree has no Cyrillic: Russian uses Inter.
 */
const SCRIPT_FONTS: Record<Lang, string[]> = {
  en: [],
  ja: ["Noto Sans JP"],
  "zh-CN": ["Noto Sans SC"],
  "zh-TW": ["Noto Sans TC"],
  ko: ["Noto Sans KR"],
  es: [],
  pt: [],
  fr: [],
  de: [],
  ru: ["Inter"],
};

interface Fonts {
  sans: string[];
  mono: string[];
}

const ThemeContext = createContext<Theme>(THEMES.dark);
const useTheme = () => useContext(ThemeContext);
const CopyContext = createContext<Copy>(copy.en);
const useCopy = () => useContext(CopyContext);
const FontContext = createContext<Fonts>({ sans: [SANS], mono: [MONO] });
/** Families for translated text in the current language. */
const useFonts = () => useContext(FontContext);

/** `size`, or less if `text` would be wider than `max`: translations vary a lot in length. */
const fit = (text: string, style: TextStyle, max: number) => Math.min(style.size, fitFontSize(text, style, max));

const io = Easing.inOut(Easing.cubic);

/** Shared scene exit: drift and fade over the last frames of a scene. */
function useExit(dx = 0, dy = -30) {
  const f = useCurrentFrame();
  const t = tween(f, [SCENE - 18, SCENE - 2], [0, 1], Easing.in(Easing.cubic));
  return {
    opacity: round(1 - t),
    transform: `translate(${round(dx * t)}px, ${round(dy * t)}px)`,
  };
}

// ---------------------------------------------------------------------------------------------
// logo (same drawing as examples/logo, 548 × 168 units)

const LOGO_W = 548;
const LOGO_FONT = { family: WORDMARK, weight: 600, size: 100 };

/** Play triangle with its centroid at (0, 0), `s` = half height. */
const play = (s: number) => {
  const w = s * 1.85;
  return `M${round(-w / 3)} ${-s} L${round((w * 2) / 3)} 0 L${round(-w / 3)} ${s} Z`;
};

const holes = [0, 1, 2, 3, 4].map((i) => {
  const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
  return { cx: round(Math.cos(a) * 19.5), cy: round(Math.sin(a) * 19.5) };
});

/** Orange disc with five holes, play mark at the hub. `turn` must end on a multiple of 72°. */
function Reel({ grow, turn, hub }: { grow: number; turn: number; hub: number }) {
  const id = useSvgId("reel");
  return (
    <g style={{ transform: `scale(${round(Math.max(0, grow), 3)})` }}>
      <mask id={id}>
        <circle r={28} fill="#fff" />
        {holes.map((h, i) => (
          <circle key={i} cx={h.cx} cy={h.cy} r={5.5} fill="#000" />
        ))}
      </mask>
      <g style={{ transform: `rotate(${round(turn, 2)}deg)` }}>
        <circle r={28} fill={ORANGE} mask={`url(#${id})`} />
      </g>
      <g style={{ transform: `scale(${round(Math.max(0, hub), 3)})` }}>
        <path d={play(7)} fill="#fff" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** The reel spins in and settles, the wordmark rises letter by letter. */
function Logo({ x, y, scale, delay = 0 }: { x: number; y: number; scale: number; delay?: number }) {
  const C = useTheme();
  const f = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  const grow = spring({ frame: f, fps, config: { damping: 11, mass: 0.7 } });
  const hub = spring({ frame: f - 10, fps, config: { damping: 10, mass: 0.5 } });
  const turn = interpolateTurn(f);
  const svgW = measureText("svg", LOGO_FONT);
  const rise = (index: number) => {
    const s = spring({ frame: f - 12 - index * 2.5, fps, config: { damping: 13, mass: 0.6 } });
    return {
      opacity: round(Math.min(1, Math.max(0, s) * 1.6), 3),
      transform: `translate(${round((1 - s) * -10)}px, ${round((1 - s) * 26)}px)`,
    };
  };
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <Text x={186} y={109} {...LOGO_FONT} fill={C.text} charStyle={({ index }: CharInfo) => rise(index)}>
        svg
      </Text>
      <Text
        x={186 + svgW + 1}
        y={109}
        {...LOGO_FONT}
        fill={ORANGE}
        charStyle={({ index }: CharInfo) => rise(index + 3)}
      >
        reel
      </Text>
      <g transform="translate(92 84) scale(2.2)">
        <Reel grow={grow} hub={hub} turn={turn} />
      </g>
    </g>
  );
}

/** One and a half turns back to rest (−432° = 6 × 72°), easing out. */
const interpolateTurn = (f: number) => tween(f, [0, 50], [-432, 0], Easing.out(Easing.cubic));

// ---------------------------------------------------------------------------------------------
// chrome

function Background() {
  const C = useTheme();
  const f = useCurrentFrame();
  return (
    <g>
      <rect width={W} height={H} fill={C.bg} />
      <DotGrid color={C.dim} />
      <GlowOrb
        color={ORANGE}
        intensity={C.orb}
        style={{
          transform: `translate(${round(860 + oscillate(f, 300, N) * 120)}px, ${round(230 + oscillate(f, 200, N, 0.25) * 60)}px)`,
        }}
      />
    </g>
  );
}

function Progress() {
  const C = useTheme();
  const f = useCurrentFrame();
  const tail = tween(f, [N - 26, N - 2], [0, 1], io);
  return (
    <ProgressBar
      x={80}
      y={H - 28}
      width={W - 160}
      value={f / (N - 1)}
      start={tail}
      marks={SCENES.map((_, i) => (i * SCENE) / (N - 1))}
      track={C.border}
      fill={ORANGE}
      markColor={C.dim}
    />
  );
}

/** Small "02 COMPILE" label above a scene heading. */
function StepLabel({ n, label, y }: { n: number; label: string; y: number }) {
  const C = useTheme();
  const f = useCurrentFrame();
  return (
    <Text
      x={80}
      y={y}
      family={MONO}
      weight={700}
      size={15}
      letterSpacing={2}
      fill={C.accentText}
      charStyle={charAnimations.type({ frame: f, delay: 2, stagger: 0.8 })}
    >
      {`${String(n).padStart(2, "0")}  ${label}`}
    </Text>
  );
}

function Heading({
  y,
  size: maxSize,
  maxWidth = W - 160,
  children,
  delay = 6,
}: {
  y: number;
  size: number;
  maxWidth?: number;
  children: string;
  delay?: number;
}) {
  const C = useTheme();
  const F = useFonts();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const size = round(
    fit(children, { family: F.sans, weight: 800, size: maxSize, letterSpacing: -maxSize / 40 }, maxWidth),
  );
  return (
    <Text
      x={80}
      y={y}
      family={F.sans}
      weight={800}
      size={size}
      letterSpacing={round(-size / 40)}
      fill={C.text}
      charStyle={charAnimations.slide({ frame: f, fps, delay, stagger: 1 })}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------------------------
// 1. intro

function Intro() {
  const C = useTheme();
  const F = useFonts();
  const t = useCopy();
  const scale = 1.15;
  const taglineSize = round(fit(t.tagline, { family: F.sans, weight: 700, size: 36 }, 900));
  const sublineSize = round(fit(t.subline, { family: F.sans, weight: 500, size: 24 }, 900));
  return (
    <g style={useExit(0, -40)}>
      <Logo x={round((W - LOGO_W * scale) / 2)} y={140} scale={scale} delay={4} />
      <Appear at={40} distance={24}>
        <Text x={W / 2} y={420} anchor="middle" family={F.sans} weight={700} size={taglineSize} fill={C.text}>
          {t.tagline}
        </Text>
      </Appear>
      <Appear at={52} distance={18}>
        <Text x={W / 2} y={468} anchor="middle" family={F.sans} weight={500} size={sublineSize} fill={C.muted}>
          {t.subline}
        </Text>
      </Appear>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// 2. write

const CODE_FONT = { family: MONO, size: 17 };
const CODE_START = 12;
/** Frames per typed character (CodeBlock's linePause stays at its default, 2). */
const CODE_SPEED = 0.2;
/** When the code has finished typing, the way CodeBlock times it. */
const CODE_DONE = CODE_START + code.reduce((s, l) => s + Math.max([...l].length, 1) * CODE_SPEED + 2, 0);
/** The preview's frame 0: just after the code is typed. */
const HELLO_FROM = Math.round(CODE_DONE) + 2;

/**
 * The component the code block shows, run in the preview. Only position, font family and color
 * are added; the animation is the same call.
 */
function Hello() {
  const C = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = charAnimations.pop({ frame, fps });
  return (
    <Text x={290} y={430} anchor="middle" family={SANS} fill={C.text} size={80} weight={800} charStyle={pop}>
      Hello
    </Text>
  );
}

const FORMULA_FONT = { family: MONO, weight: 700, size: 30 };
/**
 * React's `UI = f(state)` becomes `SVG = f(time)` like a rolling counter: the old words roll up
 * and out (frames 40–48), the new ones roll up into place (46–56), and `= f(` slides over by the
 * difference in length meanwhile. Monospace, so columns are cells.
 */
function Formula({ x, y }: { x: number; y: number }) {
  const C = useTheme();
  const f = useCurrentFrame();
  const cell = measureText("0", FORMULA_FONT);
  const out = tween(f, [40, 48], [0, 1], Easing.in(Easing.cubic));
  const into = tween(f, [46, 56], [0, 1], Easing.out(Easing.cubic));
  const slide = tween(f, [42, 54], [0, 1], io);
  const [fromL, fromR] = formula.from;
  const [toL, toR] = formula.to;
  const col = (n: number) => x + round(n * cell);
  // `<left> = f(<right>)`: "= f(" starts after the left word and a space, the right word 4 cells later.
  const word = (text: string, at: number, shown: number, dir: 1 | -1, fill: string) => (
    <Text
      x={col(at)}
      y={y}
      {...FORMULA_FONT}
      fill={fill}
      style={{
        opacity: round(shown),
        transform: `translateY(${round(dir * 16 * (1 - shown))}px)`,
      }}
    >
      {text}
    </Text>
  );
  return (
    <Appear at={10} distance={16}>
      {word(fromL, 0, 1 - out, -1, C.muted)}
      {word(fromR, fromL.length + 5, 1 - out, -1, C.muted)}
      {word(toL, 0, into, 1, C.accentText)}
      {word(toR, toL.length + 5, into, 1, C.accentText)}
      <g style={{ transform: `translateX(${round((toL.length - fromL.length) * cell * slide)}px)` }}>
        <Text x={col(fromL.length + 1)} y={y} {...FORMULA_FONT} fill={C.text}>
          = f(
        </Text>
      </g>
      <Text x={col(fromL.length + fromR.length + 5)} y={y} {...FORMULA_FONT} fill={C.text}>
        )
      </Text>
    </Appear>
  );
}

function Write() {
  const C = useTheme();
  const F = useFonts();
  const t = useCopy();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame: f - 6, fps, config: { damping: 14 } });
  const hello = HELLO_FROM;
  const glow = pulse(f, hello, 4, 24);
  // The left column ends where the code block starts (x = 540).
  const subSize = round(fit(t.write.sub, { family: F.sans, weight: 500, size: 20 }, 430));
  return (
    <g style={useExit(-60, 0)}>
      <StepLabel n={1} label="WRITE" y={120} />
      <Heading y={176} size={52} maxWidth={430}>
        {t.write.title}
      </Heading>
      <Formula x={80} y={236} />
      <Appear at={30} distance={14}>
        <Text x={80} y={276} family={F.sans} weight={500} size={subSize} fill={C.muted}>
          {t.write.sub}
        </Text>
      </Appear>

      <Appear at={20} distance={24}>
        <rect x={80} y={304} width={420} height={186} rx={14} fill={C.surface} stroke={C.border} strokeWidth={1.5} />
        <rect
          x={80}
          y={304}
          width={420}
          height={186}
          rx={14}
          fill="none"
          stroke={ORANGE}
          strokeWidth={2}
          style={{ opacity: round(glow) }}
        />
        <Text x={100} y={332} family={F.mono} size={14} fill={C.muted}>
          {t.write.preview}
        </Text>
        <Sequence from={hello} durationInFrames={SCENE - hello}>
          <Hello />
        </Sequence>
        <line x1={100} y1={468} x2={480} y2={468} stroke={C.border} strokeWidth={3} strokeLinecap="round" />
        <circle
          cx={100}
          cy={468}
          r={6}
          fill={ORANGE}
          style={{ transform: `translateX(${round(tween(f, [hello, hello + 26], [0, 380], (v) => v))}px)` }}
        />
      </Appear>

      <g
        style={{
          opacity: round(Math.min(1, card * 2)),
          transform: `translateX(${round((1 - card) * 90)}px)`,
        }}
      >
        <CodeBlock
          x={540}
          y={140}
          width={580}
          font={CODE_FONT}
          theme={C.code}
          file="hello.tsx"
          lang="TSX"
          lines={code}
          start={CODE_START}
          speed={CODE_SPEED}
        />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// 3. compile

const STRIP = { x: 80, y: 200, w: 1040, h: 130 };
const FRAMES = 6;
const frameX = (i: number) => STRIP.x + 20 + i * 170;
const FRAME_Y = STRIP.y + 22;
/** The ball's x inside a 150-wide thumbnail, eased like the CSS on screen. */
const ballX = (i: number) => round(20 + Easing.out(Easing.cubic)(i / (FRAMES - 1)) * 110);

function FilmStrip() {
  const C = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f - 4, fps, config: { damping: 16, mass: 0.9 } });
  const scan = tween(f, [34, 64], [0, 1], io);
  const track = `M${frameX(0) + ballX(0)} ${FRAME_Y + 43} ${Array.from({ length: FRAMES - 1 }, (_, k) => {
    const i = k + 1;
    return `L${frameX(i) + ballX(i)} ${FRAME_Y + 43}`;
  }).join(" ")}`;
  const holesX = Array.from({ length: 40 }, (_, k) => STRIP.x + 14 + k * 26);
  return (
    <g style={{ transform: `translateX(${round((1 - enter) * -1200)}px)` }}>
      <rect x={STRIP.x} y={STRIP.y} width={STRIP.w} height={STRIP.h} rx={10} fill={C.surface} stroke={C.border} />
      {holesX.map((hx) => (
        <g key={hx}>
          <rect x={hx} y={STRIP.y + 7} width={10} height={7} rx={2} fill={C.bg} />
          <rect x={hx} y={STRIP.y + STRIP.h - 14} width={10} height={7} rx={2} fill={C.bg} />
        </g>
      ))}
      {Array.from({ length: FRAMES }, (_, i) => {
        const hit = pulse(f, 34 + i * 6, 3, 12);
        return (
          <g key={i} transform={`translate(${frameX(i)} ${FRAME_Y})`}>
            <rect width={150} height={86} rx={6} fill={C.bg} stroke={C.border} />
            <rect
              width={150}
              height={86}
              rx={6}
              fill="none"
              stroke={ORANGE}
              strokeWidth={2}
              style={{ opacity: round(hit) }}
            />
            <Text x={8} y={18} family={MONO} size={13} fill={C.muted}>
              {`f${i * 6}`}
            </Text>
            <circle cx={ballX(i)} cy={43} r={11} fill={ORANGE} />
          </g>
        );
      })}
      <DrawPath
        d={track}
        stroke={ORANGE}
        strokeWidth={2}
        strokeOpacity={0.55}
        progress={tween(f, [40, 68], [0, 1], io)}
      />
      <rect
        x={STRIP.x}
        y={STRIP.y + 4}
        width={4}
        height={STRIP.h - 8}
        rx={2}
        fill={ORANGE}
        style={{
          opacity: round(Math.min(1, scan * 8) * (1 - tween(f, [62, 70], [0, 1], (v) => v))),
          transform: `translateX(${round(scan * (STRIP.w - 4))}px)`,
        }}
      />
    </g>
  );
}

function Compile() {
  const C = useTheme();
  const F = useFonts();
  const t = useCopy();
  const subSize = round(fit(t.compile.sub, { family: F.sans, weight: 500, size: 20 }, W - 160));
  // Points run from x = 776 to the right margin; one size for all three keeps them even.
  const pointSize = round(
    Math.min(...t.compile.points.map((p) => fit(p, { family: F.sans, weight: 700, size: 24 }, W - 80 - 776))),
  );
  return (
    <g style={useExit(0, -30)}>
      <StepLabel n={2} label="COMPILE" y={82} />
      <Heading y={134} size={46}>
        {t.compile.title}
      </Heading>
      <Appear at={12} distance={14}>
        <Text x={80} y={174} family={F.sans} weight={500} size={subSize} fill={C.muted}>
          {t.compile.sub}
        </Text>
      </Appear>
      <FilmStrip />
      <Appear at={50} distance={24}>
        <CodeBlock
          x={80}
          y={352}
          width={620}
          font={{ family: MONO, size: 16 }}
          lineHeight={26}
          theme={C.code}
          file="hello.svg"
          lang="CSS"
          lines={css}
          start={56}
          speed={0.2}
        />
      </Appear>
      {t.compile.points.map((p, i) => (
        <Appear key={p} at={74 + i * 7} preset="left" distance={30}>
          <circle cx={756} cy={390 + i * 56} r={6} fill={ORANGE} />
          <Text x={776} y={390 + i * 56} baseline="middle" family={F.sans} weight={700} size={pointSize} fill={C.text}>
            {p}
          </Text>
        </Appear>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// 4. features

const CARD_W = 245;
const CARD_H = 280;
const CARD_GAP = 20;

/** The Components card shows component names, not a number that could read as a count. */
const COMPONENT_ROWS = [["<CodeBlock>", "<Wipe>"], ["<Terminal>", "<Pill>"], ["<SlotCounter>"]];
const PILL = { height: 28, padding: 10, family: MONO, size: 14 };
const PILL_GAP = 8;

/** The little live demo at the top of each feature card, centred on (0, 0). */
function FeatureDemo({ index, delay }: { index: number; delay: number }) {
  const C = useTheme();
  const F = useFonts();
  const t = useCopy();
  const f = Math.min(useCurrentFrame(), SCENE);
  const { fps } = useVideoConfig();
  if (index === 0) {
    return (
      <Text
        anchor="middle"
        baseline="middle"
        family={F.sans}
        weight={800}
        size={60}
        fill={C.text}
        charStyle={charAnimations.wave({ frame: f, from: delay + 10, period: 30, amplitude: 6 })}
      >
        {t.sample}
      </Text>
    );
  }
  if (index === 1) {
    // Names of real components, row by row, each row centred.
    const top = -(COMPONENT_ROWS.length * PILL.height + (COMPONENT_ROWS.length - 1) * PILL_GAP) / 2;
    return (
      <g>
        {COMPONENT_ROWS.map((row, r) => {
          const widths = row.map((text) => pillWidth({ ...PILL, text }));
          const rowW = widths.reduce((a, b) => a + b, 0) + PILL_GAP * (row.length - 1);
          return (
            <PillRow
              key={r}
              x={round(-rowW / 2)}
              y={round(top + r * (PILL.height + PILL_GAP))}
              items={row}
              gap={PILL_GAP}
              at={delay + 8 + r * 5}
              stagger={3}
              {...PILL}
              fill={ORANGE}
              fillOpacity={0.12}
              stroke={ORANGE}
              strokeOpacity={0.5}
              color={C.text}
            />
          );
        })}
      </g>
    );
  }
  if (index === 2) {
    const tiles = [
      { bg: THEMES.dark.bg, border: THEMES.dark.border, label: "dark · en", fg: THEMES.dark.text },
      { bg: THEMES.light.bg, border: THEMES.light.border, label: "light · ja", fg: THEMES.light.text },
    ];
    return (
      <g>
        {tiles.map((tile, i) => {
          const s = spring({ frame: f - delay - 8 - i * 6, fps, config: { damping: 12 } });
          return (
            <g key={tile.label} transform={`translate(${-48 + i * 96} -6)`}>
              <g style={{ opacity: round(Math.min(1, s * 2)), transform: `scale(${round(0.6 + 0.4 * s)})` }}>
                <rect
                  x={-40}
                  y={-34}
                  width={80}
                  height={68}
                  rx={10}
                  fill={tile.bg}
                  stroke={tile.border}
                  strokeWidth={1.5}
                />
                <circle cy={-6} r={12} fill={ORANGE} />
                <rect x={-22} y={14} width={44} height={5} rx={2.5} fill={tile.fg} fillOpacity={0.6} />
              </g>
              <Text y={58} anchor="middle" family={MONO} size={13} fill={C.muted}>
                {tile.label}
              </Text>
            </g>
          );
        })}
      </g>
    );
  }
  // Beat sync: bars hit every 15 frames (a divisor of the scene, so the frozen end is a rest pose).
  const shape = [0.5, 0.8, 1, 0.7, 0.9, 0.6, 0.4];
  const since = f - delay - 10;
  const hit = since < 0 ? 0 : Math.exp(-(since % 15) / 4);
  return (
    <g transform="translate(0 36)">
      {shape.map((h, i) => (
        <rect
          key={i}
          x={-74 + i * 22}
          y={-80}
          width={14}
          height={80}
          rx={4}
          fill={i === 2 ? ORANGE : C.text}
          fillOpacity={i === 2 ? 1 : 0.75}
          style={{
            transform: `scaleY(${round(0.25 + 0.75 * h * (0.35 + 0.65 * hit), 3)})`,
            transformOrigin: "0px 0px",
          }}
        />
      ))}
    </g>
  );
}

function FeatureCard({ item, index, x, y, at }: { item: Feature; index: number; x: number; y: number; at: number }) {
  const C = useTheme();
  const F = useFonts();
  const titleSize = round(fit(item.title, { family: F.sans, weight: 800, size: 22 }, CARD_W - 40));
  return (
    <g transform={`translate(${x} ${y})`}>
      <Appear at={at} distance={30}>
        <rect width={CARD_W} height={CARD_H} rx={16} fill={C.surface} stroke={C.border} strokeWidth={1.5} />
        <g transform={`translate(${CARD_W / 2} 88)`}>
          <FeatureDemo index={index} delay={at} />
        </g>
        <line x1={20} y1={172} x2={CARD_W - 20} y2={172} stroke={C.border} />
        <Text x={20} y={208} family={F.sans} weight={800} size={titleSize} fill={C.text}>
          {item.title}
        </Text>
        <Text
          x={20}
          y={240}
          family={F.sans}
          weight={500}
          size={18}
          lineHeight={25}
          maxWidth={CARD_W - 36}
          fill={C.muted}
        >
          {item.description}
        </Text>
      </Appear>
    </g>
  );
}

function FeatureCards({ y, at = 0 }: { y: number; at?: number }) {
  const t = useCopy();
  return (
    <g>
      {t.features.items.map((item, i) => (
        <FeatureCard key={item.title} item={item} index={i} x={80 + i * (CARD_W + CARD_GAP)} y={y} at={at + i * 7} />
      ))}
    </g>
  );
}

function Features() {
  const t = useCopy();
  return (
    <g style={useExit(0, -30)}>
      <StepLabel n={3} label="FEATURES" y={92} />
      <Heading y={146} size={44}>
        {t.features.title}
      </Heading>
      <FeatureCards y={190} at={10} />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// 5. outro

function Outro() {
  const C = useTheme();
  const F = useFonts();
  const t = useCopy();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const term = spring({ frame: f - 4, fps, config: { damping: 15 } });
  const logoScale = 0.72;
  const cx = 905;
  // The right column: from the terminal's right edge (620) plus a gap to the frame's margin.
  const colW = 2 * (W - 40 - cx);
  const titleSize = round(fit(t.outro.title, { family: F.sans, weight: 800, size: 44, letterSpacing: -1 }, colW));
  const subSize = round(fit(t.outro.sub, { family: F.sans, weight: 500, size: 19 }, colW));
  return (
    <g style={useExit(0, 0)}>
      <g style={{ opacity: round(Math.min(1, term * 2)), transform: `translateY(${round((1 - term) * 40)}px)` }}>
        <Terminal
          x={80}
          y={176}
          width={540}
          height={214}
          font={{ family: MONO, size: 16 }}
          theme={{
            background: C.code.background,
            bar: C.code.header,
            border: C.border,
            text: C.text,
            prompt: C.accentText,
            accent: ORANGE,
            title: C.muted,
          }}
          title="~/hello"
          lines={terminal}
          start={10}
          speed={0.7}
        />
      </g>
      <Logo x={round(cx - (LOGO_W * logoScale) / 2)} y={150} scale={logoScale} delay={30} />
      <Appear at={56} distance={20}>
        <Text
          x={cx}
          y={350}
          anchor="middle"
          family={F.sans}
          weight={800}
          size={titleSize}
          letterSpacing={-1}
          fill={C.text}
        >
          {t.outro.title}
        </Text>
      </Appear>
      <Appear at={64} preset="fade" duration={14}>
        <Text x={cx} y={398} anchor="middle" family={MONO} weight={700} size={20} fill={C.accentText}>
          {repo}
        </Text>
        <Text x={cx} y={436} anchor="middle" family={F.sans} weight={500} size={subSize} fill={C.muted}>
          {t.outro.sub}
        </Text>
      </Appear>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------

function Frame({ children }: { children: ReactNode }) {
  const C = useTheme();
  return (
    <svg viewBox={`0 0 ${W} ${H}`}>
      {/* A nested <svg> clips to the frame without needing an id. */}
      <svg width={W} height={H} overflow="hidden">
        {children}
      </svg>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={20} fill="none" stroke={C.border} />
    </svg>
  );
}

function Promo() {
  const C = useTheme();
  const wipe = <Wipe colors={[ORANGE, C.flash, ORANGE]} opacity={[1, 0.9, 1]} duration={12} />;
  return (
    <Frame>
      <Background />
      <Sequence from={sceneStart("intro")} durationInFrames={SCENE}>
        <Intro />
      </Sequence>
      <Sequence from={sceneStart("write")} durationInFrames={SCENE}>
        <Write />
      </Sequence>
      <Sequence from={sceneStart("compile")} durationInFrames={SCENE}>
        <Compile />
      </Sequence>
      <Sequence from={sceneStart("features")} durationInFrames={SCENE}>
        <Features />
      </Sequence>
      <Sequence from={sceneStart("outro")} durationInFrames={SCENE}>
        <Outro />
      </Sequence>
      {/* Loop seam: one wipe that starts at the end and finishes at the start of the next loop. */}
      <Sequence from={N - SEAM} durationInFrames={SEAM}>
        {wipe}
      </Sequence>
      <Sequence from={-SEAM} durationInFrames={SEAM + 30}>
        {wipe}
      </Sequence>
      <Progress />
    </Frame>
  );
}

/** Static overview for the still file: logo, tagline, the four features and the repository. */
function Overview() {
  const C = useTheme();
  const F = useFonts();
  const t = useCopy();
  const taglineSize = round(fit(t.tagline, { family: F.sans, weight: 800, size: 32, letterSpacing: -0.5 }, W - 160));
  const sublineSize = round(fit(t.subline, { family: F.sans, weight: 500, size: 21 }, W - 160));
  return (
    <Frame>
      <Background />
      <Logo x={70} y={36} scale={0.7} />
      <Text x={W - 80} y={100} anchor="end" family={MONO} weight={700} size={18} fill={C.accentText}>
        {repo}
      </Text>
      <Text x={80} y={212} family={F.sans} weight={800} size={taglineSize} letterSpacing={-0.5} fill={C.text}>
        {t.tagline}
      </Text>
      <Text x={80} y={250} family={F.sans} weight={500} size={sublineSize} fill={C.muted}>
        {t.subline}
      </Text>
      <FeatureCards y={286} />
    </Frame>
  );
}

function Root() {
  const { theme, lang, motion } = useVariant<typeof variants>();
  const script = SCRIPT_FONTS[lang];
  return (
    <ThemeContext.Provider value={THEMES[theme]}>
      <FontContext.Provider value={{ sans: [SANS, ...script], mono: [MONO, ...script] }}>
        <CopyContext.Provider value={copy[lang]}>{motion === "still" ? <Overview /> : <Promo />}</CopyContext.Provider>
      </FontContext.Provider>
    </ThemeContext.Provider>
  );
}

export default defineComposition({
  component: Root,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: N,
  variants,
  markers: SCENES.map((label, i) => ({ frame: i * SCENE, label })),
  fonts: [
    ...fontsource("figtree", { family: SANS, weights: [500, 700, 800] }),
    ...fontsource("figtree", { family: WORDMARK, weights: [600], italic: true }),
    ...fontsource("jetbrains-mono", { family: MONO, weights: [400, 700], subsets: ["latin", "cyrillic"] }),
    ...fontsource("noto-sans-jp", {
      family: "Noto Sans JP",
      weights: [500, 700],
      subsets: ["japanese"],
      fallback: true,
    }),
    // Script fonts picked per language (SCRIPT_FONTS), not fallbacks.
    ...fontsource("noto-sans-sc", { family: "Noto Sans SC", weights: [500, 700], subsets: ["chinese-simplified"] }),
    ...fontsource("noto-sans-tc", { family: "Noto Sans TC", weights: [500, 700], subsets: ["chinese-traditional"] }),
    ...fontsource("noto-sans-kr", { family: "Noto Sans KR", weights: [500, 700], subsets: ["korean"] }),
    ...fontsource("inter", { family: "Inter", weights: [500, 700, 800], subsets: ["cyrillic"] }),
  ],
  title: "svgreel: motion graphics as React components, compiled to self-contained animated SVG",
});
