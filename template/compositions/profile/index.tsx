// A GitHub profile banner: intro → one scene per project → outro, looping, in dark and light.
// Content lives in content.ts; timing constants and colors are at the top of this file.

import { createContext, useContext } from "react";
import {
  Appear,
  charAnimations,
  CodeBlock,
  codeBlockHeight,
  defineComposition,
  defineVariants,
  DotGrid,
  DrawPath,
  Easing,
  fitFontSize,
  fontsource,
  GlowOrb,
  measureText,
  mixColors,
  Pill,
  PillRow,
  presence,
  ProgressBar,
  Rings,
  round,
  Sequence,
  SlotCounter,
  slotCounterWidth,
  spring,
  Text,
  tween,
  useCurrentFrame,
  useVariant,
  useVideoConfig,
  Wipe,
  type CodeTheme,
} from "svgreel";

import { profile, type Project } from "./content.js";

const W = 1200;
const H = 600;
const FPS = 30;
const INTRO = 120;
const SCENE = 150;
const OUTRO = 120;
const N = INTRO + SCENE * profile.projects.length + OUTRO;
const sceneStart = (i: number) => INTRO + i * SCENE;
const OUTRO_START = sceneStart(profile.projects.length);
/**
 * Frames of the loop-seam wipe that fall before the loop point: the wipe's `duration` (12), so
 * frame 0 is past the point where the last band leaves the frame and shows no sliver of it.
 */
const SEAM = 12;
/** Docked logo size, title x, right-hand card x in project scenes. */
const DOCK = 78;
const TITLE_X = 80 + DOCK + 18;
const CARD_X = 690;
const CARD_W = 440;

const SANS = "Inter";
const MONO = "JetBrains Mono";

interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  muted: string;
  dim: string;
  /** Middle band of the scene wipe. */
  flash: string;
  intro: string;
  orb: number;
  code: Omit<CodeTheme, "keyword" | "accent">;
}

const THEMES = {
  dark: {
    dark: true,
    bg: "#0b0f19",
    surface: "#0f1420",
    surface2: "#131a28",
    border: "#1e2633",
    text: "#e6edf3",
    muted: "#8b95a5",
    dim: "#3a4352",
    flash: "#ffffff",
    intro: "#7c83ff",
    orb: 0.4,
    code: {
      background: "#0f1420",
      header: "#131a28",
      border: "#1e2633",
      text: "#e6edf3",
      comment: "#5b6575",
      string: "#a5d6a7",
      number: "#f0a66a",
      tag: "#7dd3fc",
    },
  },
  light: {
    dark: false,
    bg: "#ffffff",
    surface: "#f6f8fa",
    surface2: "#eef1f5",
    border: "#d0d7de",
    text: "#1f2328",
    muted: "#59636e",
    dim: "#c4cbd3",
    flash: "#1f2328",
    intro: "#4f46e5",
    orb: 0.25,
    code: {
      background: "#f6f8fa",
      header: "#eef1f5",
      border: "#d0d7de",
      text: "#1f2328",
      comment: "#8c959f",
      string: "#1a7f37",
      number: "#b45b29",
      tag: "#0550ae",
    },
  },
} satisfies Record<string, Theme>;

type ThemeName = keyof typeof THEMES;

/** One output per theme (and each also gets a still file; see Banner). */
const variants = defineVariants({ theme: ["dark", "light"] });

const ThemeContext = createContext<Theme>(THEMES.dark);
const useTheme = () => useContext(ThemeContext);
const accentOf = (C: Theme, a: Project["accent"]) => (typeof a === "string" ? a : C.dark ? a.dark : a.light);

// ---------------------------------------------------------------------------------------------
// chrome

function Background() {
  const C = useTheme();
  const frame = useCurrentFrame();
  const windows: [number, number, string][] = [
    [0, INTRO, C.intro],
    ...profile.projects.map(
      (p, i) => [sceneStart(i), sceneStart(i) + SCENE, accentOf(C, p.accent)] as [number, number, string],
    ),
    [OUTRO_START, N, C.intro],
  ];
  const t = (frame / N) * Math.PI * 2;
  return (
    <g>
      <rect width={W} height={H} fill={C.bg} />
      <DotGrid color={C.dim} />
      {windows.map(([s, e, color], i) => (
        <GlowOrb
          key={i}
          color={color}
          intensity={C.orb}
          style={{
            opacity: round(presence(frame, s, e, 20, N)),
            transform: `translate(${round(900 + Math.cos(t * 2 + i) * 60)}px, ${round(220 + Math.sin(t * 3 + i) * 40)}px)`,
          }}
        />
      ))}
    </g>
  );
}

/** Reads like an address bar: the profile URL, with each project's path typed after it. */
function WindowBar() {
  const C = useTheme();
  const frame = useCurrentFrame();
  const font = { family: MONO, size: 14 };
  const handleW = measureText(profile.handle, font);
  return (
    <g>
      <rect width={W} height={48} fill={C.surface} />
      <line x1={0} y1={48} x2={W} y2={48} stroke={C.border} />
      {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
        <circle key={c} cx={28 + i * 20} cy={24} r={6} fill={c} />
      ))}
      <Text x={100} y={24} baseline="middle" {...font} fill={mixColors(C.dim, C.muted, 0.5)}>
        {profile.handle}
      </Text>
      {profile.projects.map((p, i) => (
        <Sequence key={p.path} from={sceneStart(i)} durationInFrames={SCENE}>
          <Text
            x={100 + handleW}
            y={24}
            baseline="middle"
            {...font}
            fill={C.muted}
            charStyle={charAnimations.type({
              frame: frame - sceneStart(i),
              delay: 4,
              stagger: 1,
              eraseAt: SCENE - 4 - p.path.length,
            })}
          >
            {p.path}
          </Text>
        </Sequence>
      ))}
    </g>
  );
}

function Progress() {
  const C = useTheme();
  const frame = useCurrentFrame();
  const marks = [0, ...profile.projects.map((_, i) => sceneStart(i)), OUTRO_START].map((m) => m / (N - 1));
  // Over the last frames the tail chases the head, leaving an empty bar for the next loop.
  const tail = tween(frame, [N - 26, N - 2], [0, 1], Easing.inOut(Easing.cubic));
  return (
    <ProgressBar
      x={80}
      y={H - 28}
      width={W - 160}
      value={frame / (N - 1)}
      start={tail}
      marks={marks}
      track={C.border}
      fill={C.text}
      markColor={C.dim}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// intro

function Avatar({ x, y }: { x: number; y: number }) {
  const C = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 6, fps, config: { damping: 14 } });
  return (
    <g transform={`translate(${x} ${y})`}>
      <g
        style={{
          opacity: round(Math.min(1, s * 2)),
          transform: `scale(${round(0.7 + 0.3 * s)})`,
        }}
      >
        <Rings r={150} color={C.intro} muted={C.text} speed={360 / INTRO} />
        <circle r={120} fill={C.surface2} stroke={C.border} strokeWidth={1.5} />
        <Text
          anchor="middle"
          baseline="middle"
          family={SANS}
          weight={800}
          size={96}
          letterSpacing={-3}
          fill={C.intro}
          charStyle={charAnimations.pop({ frame, fps, delay: 18, stagger: 6 })}
        >
          {profile.initials}
        </Text>
      </g>
    </g>
  );
}

function Intro() {
  const C = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = tween(frame, [INTRO - 16, INTRO], [0, 1], Easing.in(Easing.cubic));
  const nameStyle = { family: SANS, weight: 800, size: 104, letterSpacing: -3 };
  const nameSize = fitFontSize(profile.name, nameStyle, 640);
  return (
    <g
      style={{
        opacity: round(1 - exit),
        transform: `translateY(${round(-40 * exit)}px)`,
      }}
    >
      <Text
        x={80}
        y={190}
        family={MONO}
        size={26}
        fill={C.intro}
        charStyle={charAnimations.type({ frame, delay: 4, stagger: 2 })}
      >
        {profile.greeting}
      </Text>
      <Text
        x={80}
        y={300}
        {...nameStyle}
        size={nameSize}
        letterSpacing={round((-3 * nameSize) / 104)}
        fill={C.text}
        charStyle={charAnimations.rise({
          frame,
          fps,
          delay: 18,
          distance: 90,
          rotate: -14,
        })}
      >
        {profile.name}
      </Text>
      <rect
        x={80}
        y={330}
        width={220}
        height={6}
        rx={3}
        fill={C.intro}
        style={{
          transform: `scaleX(${round(tween(frame, [46, 70], [0, 1], Easing.inOut(Easing.cubic)))})`,
        }}
      />
      <Appear at={40} distance={24}>
        <Text x={80} y={392} family={SANS} weight={500} size={28} lineHeight={40} maxWidth={620} fill={C.muted}>
          {profile.tagline}
        </Text>
      </Appear>
      <Avatar x={930} y={300} />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// project scenes

/** First user-perceived character (grapheme) of a name, for monograms. */
const firstLetter = (s: string) => new Intl.Segmenter().segment(s)[Symbol.iterator]().next().value?.segment ?? "";

/** App-icon tile (100 × 100, centred on 0,0): the project's icon drawn on, or a monogram. */
function LogoTile({ p, f }: { p: Project; f: number }) {
  const C = useTheme();
  const { fps } = useVideoConfig();
  const color = accentOf(C, p.accent);
  return (
    <g>
      <rect
        x={-50}
        y={-50}
        width={100}
        height={100}
        rx={24}
        fill={mixColors(C.dark ? C.surface2 : "#ffffff", color, C.dark ? 0.16 : 0.08)}
      />
      {p.icon ? (
        <g transform="translate(-50 -50)">
          <DrawPath
            d={p.icon}
            stroke={color}
            strokeWidth={7}
            progress={tween(f, [4, 34], [0, 1], Easing.inOut(Easing.cubic))}
          />
        </g>
      ) : (
        <Text
          anchor="middle"
          baseline="middle"
          family={SANS}
          weight={800}
          size={56}
          fill={color}
          charStyle={charAnimations.pop({ frame: f, fps, delay: 4 })}
        >
          {firstLetter(p.name)}
        </Text>
      )}
      <rect
        x={-50}
        y={-50}
        width={100}
        height={100}
        rx={24}
        fill="none"
        stroke={color}
        strokeOpacity={0.45}
        strokeWidth={1.5}
      />
    </g>
  );
}

function StatsCard({ p, x, y, start }: { p: Project; x: number; y: number; start: number }) {
  const C = useTheme();
  const color = accentOf(C, p.accent);
  const stats = p.stats ?? [];
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={CARD_W} height={110 * stats.length + 30} rx={14} fill={C.surface} stroke={C.border} />
      {stats.map((s, k) => (
        <g key={s.label} transform={`translate(32 ${86 + k * 110})`}>
          <SlotCounter value={s.value} family={SANS} weight={800} size={60} fill={color} delay={start + k * 8} />
          <Text
            x={
              slotCounterWidth(s.value, {
                family: SANS,
                weight: 800,
                size: 60,
              }) + 16
            }
            y={0}
            family={SANS}
            weight={500}
            size={22}
            fill={C.muted}
          >
            {s.label}
          </Text>
        </g>
      ))}
    </g>
  );
}

const D = 40; // frames spent on the logo reveal before the rest of a scene arrives

function ProjectScene({ p, i }: { p: Project; i: number }) {
  const C = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const color = accentOf(C, p.accent);
  const exit = tween(frame, [SCENE - 16, SCENE], [0, 1], Easing.in(Easing.cubic));
  const total = profile.projects.length;

  // Logo: revealed large in the middle, then docked beside the title.
  const titleStyle = {
    family: SANS,
    weight: 800,
    size: 80,
    letterSpacing: -2.5,
  };
  const titleSize = fitFontSize(p.name, titleStyle, CARD_X - 28 - TITLE_X);
  const logoIn = spring({ frame: frame - 6, fps, config: { damping: 13 } });
  const dock = spring({
    frame: frame - 44,
    fps,
    config: { damping: 15, mass: 0.8 },
  });
  const logoX = 600 + (80 + DOCK / 2 - 600) * dock;
  const logoY = 300 + (250 - titleSize * 0.36 - 300) * dock;
  const logoS = (2.2 + (DOCK / 100 - 2.2) * dock) * (0.6 + 0.4 * logoIn);
  const cardIn = spring({
    frame: frame - (10 + D),
    fps,
    config: { damping: 14 },
  });
  const counter = `${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const cardH = p.code
    ? codeBlockHeight({
        lines: p.code.lines,
        file: p.code.file,
        lang: p.code.lang,
      })
    : 0;

  return (
    <g>
      <g
        style={{
          opacity: round(1 - exit),
          transform: `translateX(${round(-70 * exit)}px)`,
        }}
      >
        <Appear at={8 + D} distance={20}>
          <Text x={80} y={150} family={MONO} weight={700} size={18} fill={color}>
            {counter}
          </Text>
          <Pill
            x={190}
            y={130}
            height={26}
            padding={12}
            text={p.kind.toUpperCase()}
            family={MONO}
            weight={700}
            size={13}
            letterSpacing={1.5}
            stroke={color}
            strokeOpacity={0.6}
            color={color}
          />
        </Appear>
        <Text
          x={TITLE_X}
          y={250}
          {...titleStyle}
          size={titleSize}
          letterSpacing={round((-2.5 * titleSize) / 80)}
          fill={C.text}
          charStyle={charAnimations.slide({
            frame,
            fps,
            delay: 10 + D,
            stagger: 1.5,
          })}
        >
          {p.name}
        </Text>
        <Appear at={24 + D}>
          <Text x={80} y={312} family={SANS} size={26} lineHeight={38} maxWidth={CARD_X - 120} fill={C.muted}>
            {p.description}
          </Text>
        </Appear>
        <PillRow
          x={80}
          y={420}
          items={p.tags}
          at={38 + D}
          family={MONO}
          size={15}
          fill={color}
          fillOpacity={0.14}
          stroke={color}
          strokeOpacity={0.5}
          color={C.text}
        />
        <g
          style={{
            opacity: round(Math.min(1, logoIn * 2)),
            transform: `translate(${round(logoX)}px, ${round(logoY)}px) scale(${round(logoS)})`,
          }}
        >
          <LogoTile p={p} f={Math.min(frame, SCENE)} />
        </g>
      </g>

      <g
        style={{
          opacity: round(Math.min(1, cardIn * 1.5) * (1 - exit)),
          transform: `translate(1090px, 150px) scale(${round(0.6 + 0.4 * cardIn - 0.2 * exit)})`,
        }}
      >
        <Rings r={150} color={color} muted={C.text} speed={0.9} />
      </g>
      <g
        style={{
          opacity: round(Math.min(1, cardIn * 2) * (1 - exit)),
          transform: `translate(${round((1 - cardIn) * 80 + exit * 40)}px, 0px)`,
        }}
      >
        {p.code ? (
          <CodeBlock
            x={CARD_X}
            y={Math.max(110, 300 - cardH / 2 - 20)}
            width={CARD_W}
            font={{ family: MONO, size: 15 }}
            theme={{ ...C.code, keyword: color, accent: color }}
            file={p.code.file}
            lang={p.code.lang}
            lines={p.code.lines}
            start={22 + D}
          />
        ) : (
          <StatsCard p={p} x={CARD_X} y={150} start={22 + D} />
        )}
      </g>

      <Wipe colors={[color, C.flash, color]} opacity={[1, 0.9, 1]} duration={12} />
    </g>
  );
}

// ---------------------------------------------------------------------------------------------
// outro

function Outro() {
  const C = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = tween(frame, [OUTRO - 22, OUTRO - 4], [0, 1], Easing.in(Easing.cubic));
  const handleW = measureText(profile.handle, { family: MONO, size: 30 });
  const rise = charAnimations.rise({
    frame,
    fps,
    delay: 8,
    stagger: 1.2,
    distance: -60,
    config: { damping: 9, mass: 0.5 },
  });
  const wave = charAnimations.wave({
    frame,
    from: 45,
    period: 30,
    amplitude: 4,
  });
  return (
    <g style={{ opacity: round(1 - out) }}>
      <Wipe colors={[C.intro, C.flash, C.intro]} opacity={[1, 0.9, 1]} duration={12} />
      <g style={{ transform: "translate(0px, 0px)" }}>
        <Text
          x={W / 2}
          y={270}
          family={SANS}
          weight={800}
          size={76}
          letterSpacing={-2}
          anchor="middle"
          fill={C.text}
          charStyle={(c) => {
            const a = rise(c);
            const b = wave(c);
            return {
              opacity: a.opacity,
              transform: `${a.transform} ${b.transform}`,
            };
          }}
        >
          {profile.outro}
        </Text>
      </g>
      <Appear at={24} preset="fade" duration={16}>
        <Text x={W / 2 - 20} y={350} family={MONO} size={30} anchor="middle" fill={C.intro}>
          {profile.handle}
        </Text>
        <DrawPath
          d={`M${round(W / 2 + handleW / 2)} 340 h40 m-14 -12 l14 12 l-14 12`}
          stroke={C.intro}
          strokeWidth={3}
          progress={tween(frame, [30, 50], [0, 1], Easing.inOut(Easing.cubic))}
        />
      </Appear>
    </g>
  );
}

// ---------------------------------------------------------------------------------------------

function Profile({ theme }: { theme: ThemeName }) {
  const C = THEMES[theme];
  return (
    <ThemeContext.Provider value={C}>
      <svg viewBox={`0 0 ${W} ${H}`}>
        {/* A nested <svg> clips to the rounded frame without needing an id. */}
        <svg width={W} height={H} overflow="hidden">
          <Background />
          <Sequence from={0} durationInFrames={INTRO}>
            <Intro />
          </Sequence>
          {profile.projects.map((p, i) => (
            <Sequence key={p.name} from={sceneStart(i)} durationInFrames={SCENE}>
              <ProjectScene p={p} i={i} />
            </Sequence>
          ))}
          <Sequence from={OUTRO_START} durationInFrames={OUTRO}>
            <Outro />
          </Sequence>
          {/* Loop seam: one wipe that starts at the end and finishes at the start of the next loop. */}
          <Sequence from={N - SEAM} durationInFrames={SEAM}>
            <Wipe colors={[C.intro, C.flash, C.intro]} opacity={[1, 0.9, 1]} duration={12} />
          </Sequence>
          <Sequence from={-SEAM} durationInFrames={SEAM + 30}>
            <Wipe colors={[C.intro, C.flash, C.intro]} opacity={[1, 0.9, 1]} duration={12} />
          </Sequence>
          <WindowBar />
          <Progress />
        </svg>
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={20} fill="none" stroke={C.border} />
      </svg>
    </ThemeContext.Provider>
  );
}

/** Static overview for prefers-reduced-motion: everything at once. */
function Overview({ theme }: { theme: ThemeName }) {
  const C = THEMES[theme];
  const cols = profile.projects.length > 2 ? 3 : 2;
  const gap = 24;
  const cardW = (W - 160 - gap * (cols - 1)) / cols;
  const cardH = 170;
  return (
    <ThemeContext.Provider value={C}>
      <svg viewBox={`0 0 ${W} ${H}`}>
        <rect width={W} height={H} rx={20} fill={C.bg} />
        <DotGrid color={C.dim} />
        <Text x={80} y={120} family={SANS} weight={800} size={56} letterSpacing={-1.5} fill={C.text}>
          {profile.name}
        </Text>
        <Text x={80} y={164} family={SANS} weight={500} size={20} fill={C.muted}>
          {profile.tagline.replace(/\n/g, " ")}
        </Text>
        {profile.projects.map((p, i) => {
          const color = accentOf(C, p.accent);
          const x = 80 + (i % cols) * (cardW + gap);
          const y = 210 + Math.floor(i / cols) * (cardH + gap);
          return (
            <g key={p.name} transform={`translate(${round(x)} ${y})`}>
              <rect width={round(cardW)} height={cardH} rx={14} fill={C.surface} stroke={C.border} />
              <rect width={4} height={cardH - 40} y={20} rx={2} fill={color} />
              <g transform="translate(42 40) scale(0.34)">
                <LogoTile p={p} f={200} />
              </g>
              <Text x={70} y={48} family={SANS} weight={800} size={22} fill={C.text}>
                {p.name}
              </Text>
              <Text x={24} y={96} family={SANS} size={15} lineHeight={21} maxWidth={cardW - 48} fill={C.muted}>
                {p.description.replace(/\n/g, " ")}
              </Text>
              <Text x={24} y={cardH - 22} family={MONO} size={13} fill={color}>
                {[p.kind, ...p.tags].join("  ·  ")}
              </Text>
            </g>
          );
        })}
        <Text x={W / 2} y={H - 36} family={MONO} size={16} anchor="middle" fill={C.intro}>
          {profile.handle}
        </Text>
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={20} fill="none" stroke={C.border} />
      </svg>
    </ThemeContext.Provider>
  );
}

/** The still file (motion "still") gets the overview instead of a frame of the animation. */
function Banner() {
  const { theme, motion } = useVariant<typeof variants>();
  return motion === "still" ? <Overview theme={theme} /> : <Profile theme={theme} />;
}

export default defineComposition({
  component: Banner,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: N,
  variants,
  markers: [
    { frame: 0, label: "intro" },
    ...profile.projects.map((p, i) => ({
      frame: sceneStart(i),
      label: p.name,
    })),
    { frame: OUTRO_START, label: "outro" },
  ],
  fonts: [
    ...fontsource("inter", {
      family: SANS,
      weights: [400, 500, 800],
    }),
    ...fontsource("jetbrains-mono", {
      family: MONO,
      weights: [400, 700],
    }),
    ...fontsource("noto-sans-jp", {
      family: "Noto Sans JP",
      weights: [400, 700],
      subsets: ["japanese"],
      fallback: true,
    }),
  ],
  title: `${profile.name} — ${profile.projects.map((p) => p.name).join(", ")}`,
});
