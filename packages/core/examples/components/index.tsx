// One card per built-in component. Copy what you need from here into your own composition.
// The accent color and the glow are params: `svgreel build --param accent=#f0a66a` rebuilds
// with another accent, without adding files.

import {
  Appear,
  CodeBlock,
  defineComposition,
  defineParams,
  DirectionProvider,
  DrawPath,
  GlowOrb,
  Image,
  param,
  PillRow,
  presence,
  ProgressBar,
  Rings,
  round,
  Sequence,
  Text,
  tween,
  useCurrentFrame,
  useParams,
  WindowFrame,
  Wipe,
  type CodeTheme,
} from "svgreel";
import { Backdrop, C, Card, cell, H, MONO, SANS, showcaseFonts, W } from "../_shared/showcase.js";

const N = 240;

const CODE: CodeTheme = {
  background: "#0c111c",
  header: C.raised,
  border: C.border,
  text: C.text,
  comment: C.faint,
  string: "#a5d6a7",
  keyword: C.accent,
  number: C.warm,
  tag: "#7dd3fc",
  accent: C.accent,
};

const params = defineParams({
  accent: param.color(C.accent, { description: "Glow, rings, progress bar and wipe" }),
  glow: param.number(0.35, { min: 0, max: 1, step: 0.05, label: "Glow intensity" }),
  windowPreset: param.select(["macos", "windows", "gnome", "plain"], "macos", { label: "Window preset" }),
  dir: param.select(["ltr", "rtl"], "ltr", { label: "Window direction" }),
});

function Components() {
  const frame = useCurrentFrame();
  const { accent, glow, windowPreset, dir } = useParams<typeof params>();
  const t = (frame / N) * Math.PI * 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`}>
      <Backdrop
        title="Components"
        subtitle="One card per built-in component"
        path="examples/components"
        glow={
          <GlowOrb
            color={accent}
            intensity={glow}
            style={{
              transform: `translate(${round(900 + Math.cos(t) * 80)}px, ${round(220 + Math.sin(t * 2) * 40)}px)`,
            }}
          />
        }
      />

      <Card {...cell(0, 0)} label="<CodeBlock>" note="typed out, then a caret">
        <CodeBlock
          x={22}
          y={2}
          width={320}
          font={{ family: MONO, size: 13 }}
          lineHeight={22}
          theme={CODE}
          file="hello.ts"
          lang="TypeScript"
          start={10}
          lines={[
            "// typed out, then a blinking caret",
            'import { spring } from "svgreel";',
            "",
            "const answer = 42;",
            "export default answer;",
          ]}
        />
      </Card>

      <Card {...cell(1, 0)} label="<PillRow> / <Appear>" note="staggered entrances">
        <PillRow
          x={22}
          y={8}
          items={["React", "SVG", "CSS"]}
          at={20}
          family={MONO}
          size={14}
          fill={C.accent}
          fillOpacity={0.14}
          stroke={C.accent}
          strokeOpacity={0.5}
          color={C.text}
        />
        <PillRow
          x={22}
          y={52}
          items={["keyframes", "outlines"]}
          at={32}
          family={MONO}
          size={14}
          fill={C.warm}
          fillOpacity={0.14}
          stroke={C.warm}
          strokeOpacity={0.5}
          color={C.text}
        />
        {(["up", "left", "scale", "pop"] as const).map((p, i) => (
          <Appear key={p} at={50 + i * 10} preset={p} origin={[22 + i * 82 + 30, 140]}>
            <rect
              x={22 + i * 82}
              y={110}
              width={60}
              height={60}
              rx={12}
              fill={C.accent}
              fillOpacity={0.18}
              stroke={C.accent}
              strokeOpacity={0.7}
            />
            <Text x={22 + i * 82 + 30} y={194} anchor="middle" family={MONO} size={12} fill={C.muted}>
              {p}
            </Text>
          </Appear>
        ))}
      </Card>

      <Card {...cell(2, 0)} label="<Rings> + <Image>" note="avatar halo">
        <Rings x={182} y={112} r={80} color={accent} muted={C.text} speed={3} />
        {/* For a GitHub avatar: src={await fetchImage("https://github.com/<user>.png?size=192")} */}
        <Image src={new URL("./avatar.png", import.meta.url)} x={134} y={64} width={96} height={96} radius={48} />
      </Card>

      <Card {...cell(0, 1)} label="<DrawPath>" note="strokes drawn on">
        <DrawPath d="M62 110 l40 40 l80 -90" stroke={C.green} strokeWidth={10} progress={tween(frame, [20, 50])} />
        <DrawPath
          d="M202 150 C 232 30, 302 30, 322 150"
          stroke={C.warm}
          strokeWidth={4}
          progress={tween(frame, [40, 90])}
        />
        <DrawPath d="M42 200 h280" stroke={C.dim} strokeWidth={2} progress={tween(frame, [60, 120])} />
      </Card>

      <Card {...cell(1, 1)} label="<ProgressBar>" note="marks, fill, range">
        {[
          { y: 44, label: "looping, with marks" },
          { y: 112, label: "filling once" },
          { y: 180, label: "draining from the start" },
        ].map(({ y, label }) => (
          <Text key={label} x={22} y={y - 16} family={SANS} size={12} fill={C.faint}>
            {label}
          </Text>
        ))}
        <ProgressBar
          x={22}
          y={44}
          width={320}
          height={4}
          value={(frame % 120) / 119}
          marks={[0, 0.33, 0.66, 1]}
          fill={accent}
          track={C.dim}
        />
        <ProgressBar
          x={22}
          y={112}
          width={320}
          height={10}
          value={tween(frame, [10, 80])}
          fill={C.green}
          track={C.dim}
        />
        <ProgressBar
          x={22}
          y={180}
          width={320}
          height={10}
          value={1}
          start={tween(frame, [120, 200])}
          fill={C.warm}
          track={C.dim}
        />
      </Card>

      <Card {...cell(2, 1)} label="<WindowFrame> + <Wipe>">
        <DirectionProvider dir={dir}>
          <WindowFrame
            x={22}
            y={0}
            width={320}
            height={210}
            preset={windowPreset}
            title="preview"
            font={{ family: SANS, size: 13 }}
          >
            <Text
              x={160}
              y={90}
              anchor="middle"
              baseline="middle"
              family={SANS}
              weight={800}
              size={32}
              fill={C.text}
              style={{ opacity: round(presence(frame, 0, 120, 10, N)) }}
            >
              Scene A
            </Text>
            <Text
              x={160}
              y={90}
              anchor="middle"
              baseline="middle"
              family={SANS}
              weight={800}
              size={32}
              fill={C.warm}
              style={{ opacity: round(presence(frame, 120, 240, 10, N)) }}
            >
              Scene B
            </Text>
          </WindowFrame>
        </DirectionProvider>
      </Card>

      {/* A full-frame wipe at the cut between "scenes". */}
      <Sequence from={112} durationInFrames={30}>
        <Wipe colors={[accent, "#ffffff", accent]} opacity={[1, 0.85, 1]} />
      </Sequence>
    </svg>
  );
}

export default defineComposition({
  component: Components,
  width: W,
  height: H,
  fps: 30,
  durationInFrames: N,
  stillFrame: 100,
  title: "svgreel components",
  params,
  markers: [
    { frame: 10, label: "code" },
    { frame: 112, label: "wipe" },
  ],
  fonts: showcaseFonts(),
});
