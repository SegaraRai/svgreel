// Text features: per-glyph animation presets, CJK fallback, wrapping, OpenType features, sizes.

import {
  Appear,
  charAnimations,
  defineComposition,
  fontsource,
  SlotCounter,
  Text,
  Typewriter,
  useCurrentFrame,
  useVideoConfig,
} from "svgreel";
import { Backdrop, C, Card, CARD, cell, H, MONO, SANS, showcaseFonts, W } from "../_shared/showcase.js";

const N = 240;
const JP = "Noto Sans JP";

const PARA =
  "Text is shaped with fontkit and emitted as outlines, so the SVG renders identically everywhere — no web fonts. 日本語も自動でフォールバックし、禁則処理つきで折り返します。";

/** Each size sits 8 px below the one before it. */
const LADDER = [11, 13, 16, 20, 26, 32].map((size, i, all) => ({
  size,
  baseline: 4 + all.slice(0, i + 1).reduce((a, s) => a + s + 8, 0),
}));

function Caption({ y, children }: { y: number; children: string }) {
  return (
    <Text x={22} y={y} family={SANS} size={12} fill={C.faint}>
      {children}
    </Text>
  );
}

function Typography() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <svg viewBox={`0 0 ${W} ${H}`}>
      <Backdrop title="Typography" subtitle="Shaped, outlined and animated per glyph" path="examples/typography" />

      <Card {...cell(0, 0)} w={CARD.w * 2 + 18} label="charAnimations" note="rise + rotate, then pop">
        <Text
          x={22}
          y={88}
          family={SANS}
          weight={800}
          size={66}
          letterSpacing={-2}
          fill={C.text}
          charStyle={charAnimations.rise({ frame, fps, delay: 6, rotate: -12 })}
        >
          Outlined, animated
        </Text>
        <Text
          x={22}
          y={166}
          family={SANS}
          weight={700}
          size={38}
          fill={C.accent}
          charStyle={charAnimations.pop({ frame, fps, delay: 30, stagger: 1.5 })}
        >
          こんにちは、svgreel！「動く」SVG
        </Text>
        <Caption y={220}>Inter, falling back to Noto Sans JP (registered with fallback: true) glyph by glyph</Caption>
      </Card>

      <Card {...cell(2, 0)} label="<Typewriter> / <SlotCounter>" color={C.warm}>
        <Caption y={26}>typed, then erased</Caption>
        <Typewriter
          x={22}
          y={66}
          text="pnpm build --watch"
          family={MONO}
          size={20}
          fill={C.text}
          caretColor={C.accent}
          start={70}
          speed={3}
          eraseAt={190}
        />
        <Caption y={124}>digits roll into place</Caption>
        <SlotCounter x={22} y={186} value="12,480" family={SANS} weight={800} size={48} fill={C.warm} delay={90} />
        <Text x={222} y={186} family={SANS} weight={500} size={20} fill={C.muted}>
          stars
        </Text>
      </Card>

      <Card {...cell(0, 1)} label="maxWidth" note="wrapping with kinsoku" color={C.green}>
        <rect x={22} y={4} width={320} height={220} rx={6} fill="none" stroke={C.dim} strokeDasharray="4 4" />
        <Appear at={50} preset="up">
          <Text x={36} y={36} family={SANS} size={17} lineHeight={28} maxWidth={292} fill={C.muted}>
            {PARA}
          </Text>
        </Appear>
      </Card>

      <Card {...cell(1, 1)} label="features" note="palt: proportional kana" color={C.pink}>
        <Caption y={26}>default</Caption>
        <Text x={22} y={84} family={JP} weight={700} size={32} fill={C.text}>
          「さあ、始めよう。」
        </Text>
        <Caption y={136}>{'features={["palt"]}'}</Caption>
        <Text x={22} y={194} family={JP} weight={700} size={32} features={["palt"]} fill={C.accent}>
          「さあ、始めよう。」
        </Text>
      </Card>

      <Card {...cell(2, 1)} label="Size ladder" note="small sizes are the hardest">
        {LADDER.map(({ size, baseline }) => (
          <g key={size}>
            <Text x={22} y={baseline} family={MONO} size={11} fill={C.faint}>
              {`${size}px`}
            </Text>
            <Text x={70} y={baseline} family={SANS} size={size} fill={C.text}>
              Ty Aa 漢字 0123
            </Text>
          </g>
        ))}
      </Card>
    </svg>
  );
}

export default defineComposition({
  component: Typography,
  width: W,
  height: H,
  fps: 30,
  durationInFrames: N,
  stillFrame: 180,
  title: "svgreel typography",
  markers: [
    { frame: 6, label: "heading" },
    { frame: 30, label: "japanese" },
    { frame: 70, label: "typewriter" },
    { frame: 190, label: "erase" },
  ],
  fonts: [
    ...showcaseFonts([500, 700]),
    ...fontsource("noto-sans-jp", { family: JP, weights: [400, 700], subsets: ["japanese"], fallback: true }),
  ],
});
