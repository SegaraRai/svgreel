// Text features: per-glyph animation presets, CJK fallback, wrapping, OpenType features, sizes.

import {
  Appear,
  charAnimations,
  defineComposition,
  fontsource,
  measureText,
  SlotCounter,
  Text,
  Typewriter,
  useCurrentFrame,
  useVideoConfig,
} from "svgreel";

const W = 1200;
const H = 720;
const N = 240;

const SANS = "Inter";
const MONO = "JetBrains Mono";
const JP = "Noto Sans JP";

const C = { bg: "#0d1117", text: "#e6edf3", muted: "#8b949e", dim: "#30363d", accent: "#7aa2ff" };

function Label({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <Text x={x} y={y} family={MONO} size={13} fill={C.muted} letterSpacing={0.5}>
      {children}
    </Text>
  );
}

function DemoText() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const para =
    "Text is shaped with fontkit and emitted as outlines, so the SVG renders identically everywhere — no web fonts. 日本語も自動でフォールバックし、禁則処理つきで折り返します。";
  return (
    <svg viewBox={`0 0 ${W} ${H}`}>
      <rect width={W} height={H} fill={C.bg} />

      <Label x={60} y={60}>
        charAnimations.rise + rotate
      </Label>
      <Text
        x={60}
        y={140}
        family={SANS}
        weight={800}
        size={72}
        letterSpacing={-2}
        fill={C.text}
        charStyle={charAnimations.rise({ frame, fps, delay: 6, rotate: -12 })}
      >
        Outlined, animated
      </Text>

      <Label x={60} y={200}>
        Fallback chain: Inter, then Noto Sans JP (registered with fallback: true)
      </Label>
      <Text
        x={60}
        y={256}
        family={SANS}
        weight={700}
        size={44}
        fill={C.text}
        charStyle={charAnimations.pop({ frame, fps, delay: 30, stagger: 1.5 })}
      >
        こんにちは、svgreel！「動く」SVG
      </Text>

      <Label x={60} y={316}>
        maxWidth wrapping with kinsoku (520 px)
      </Label>
      <rect x={60} y={330} width={520} height={150} fill="none" stroke={C.dim} strokeDasharray="4 4" />
      <Appear at={50} preset="up">
        <Text x={60} y={356} family={SANS} size={19} lineHeight={29} maxWidth={520} fill={C.muted}>
          {para}
        </Text>
      </Appear>

      <Label x={640} y={316}>
        features: palt (proportional kana)
      </Label>
      <Text x={640} y={370} family={JP} weight={700} size={34} fill={C.text}>
        「さあ、始めよう。」
      </Text>
      <Text x={640} y={420} family={JP} weight={700} size={34} features={["palt"]} fill={C.accent}>
        「さあ、始めよう。」
      </Text>

      <Label x={640} y={470}>
        Typewriter / SlotCounter
      </Label>
      <Typewriter
        x={640}
        y={512}
        text="pnpm build --watch"
        family={MONO}
        size={22}
        fill={C.text}
        caretColor={C.accent}
        start={70}
        speed={3}
        eraseAt={190}
      />
      <SlotCounter x={640} y={584} value="12,480" family={SANS} weight={800} size={48} fill={C.accent} delay={90} />
      <Text x={850} y={584} family={SANS} weight={500} size={22} fill={C.muted}>
        stars
      </Text>

      <Label x={60} y={530}>
        Size ladder (small sizes are the hardest for outlines)
      </Label>
      {[11, 13, 16, 20, 26, 34].map((s, i, all) => {
        const x =
          60 + all.slice(0, i).reduce((a, b) => a + measureText(`${b}px Aa`, { family: SANS, size: b }) + 20, 0);
        return (
          <Text key={s} x={x} y={600} family={SANS} size={s} fill={C.text}>
            {`${s}px Aa`}
          </Text>
        );
      })}
      <Text x={60} y={650} family={SANS} size={14} fill={C.muted}>
        The quick brown fox jumps over the lazy dog. 0123456789 — いろはにほへと 漢字
      </Text>
      <Text x={60} y={680} family={SANS} weight={600} size={14} letterSpacing={1.5} fill={C.muted}>
        LETTER-SPACED CAPS · AVATAR · WAVE · Ty To Yo
      </Text>
    </svg>
  );
}

export default defineComposition({
  component: DemoText,
  width: W,
  height: H,
  fps: 30,
  durationInFrames: N,
  stillFrame: 180,
  title: "svgreel text demo",
  markers: [
    { frame: 6, label: "heading" },
    { frame: 30, label: "japanese" },
    { frame: 70, label: "typewriter" },
    { frame: 190, label: "erase" },
  ],
  fonts: [
    ...fontsource("inter", { family: SANS, weights: [400, 500, 600, 700, 800] }),
    ...fontsource("jetbrains-mono", { family: MONO, weights: [400] }),
    ...fontsource("noto-sans-jp", { family: JP, weights: [400, 700], subsets: ["japanese"], fallback: true }),
  ],
});
