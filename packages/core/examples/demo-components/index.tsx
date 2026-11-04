// One cell per built-in component. Copy what you need from here into your own composition.

import type { ReactNode } from "react";
import {
  Appear,
  CodeBlock,
  defineComposition,
  DotGrid,
  DrawPath,
  fontsource,
  GlowOrb,
  Image,
  PillRow,
  presence,
  ProgressBar,
  Rings,
  round,
  Sequence,
  Text,
  tween,
  useCurrentFrame,
  WindowFrame,
  Wipe,
  type CodeTheme,
} from "svgreel";

const W = 1200;
const H = 720;
const N = 240;
const SANS = "Inter";
const MONO = "JetBrains Mono";

const C = {
  bg: "#0b0f19",
  text: "#e6edf3",
  muted: "#8b95a5",
  dim: "#2a3242",
  accent: "#7aa2ff",
  warm: "#f0a66a",
  green: "#7ee2a8",
};

const CODE: CodeTheme = {
  background: "#0f1420",
  header: "#131a28",
  border: "#1e2633",
  text: C.text,
  comment: "#5b6575",
  string: "#a5d6a7",
  keyword: C.accent,
  number: C.warm,
  tag: "#7dd3fc",
  accent: C.accent,
};

function Cell({ x, y, label, children }: { x: number; y: number; label: string; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={360} height={300} rx={16} fill="#0f1420" stroke={C.dim} />
      <Text x={20} y={32} family={MONO} size={13} fill={C.muted}>
        {label}
      </Text>
      <g transform="translate(0 44)">{children}</g>
    </g>
  );
}

function Demo() {
  const frame = useCurrentFrame();
  const t = (frame / N) * Math.PI * 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`}>
      <rect width={W} height={H} fill={C.bg} />
      <DotGrid color={C.dim} />
      <GlowOrb
        color={C.accent}
        intensity={0.35}
        style={{ transform: `translate(${round(900 + Math.cos(t) * 80)}px, ${round(200 + Math.sin(t * 2) * 40)}px)` }}
      />

      <Cell x={30} y={40} label="<CodeBlock>">
        <CodeBlock
          x={20}
          y={0}
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
      </Cell>

      <Cell x={420} y={40} label="<PillRow> / <Appear>">
        <PillRow
          x={20}
          y={10}
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
          x={20}
          y={56}
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
          <Appear key={p} at={50 + i * 10} preset={p} origin={[20 + i * 80 + 30, 150]}>
            <rect
              x={20 + i * 80}
              y={120}
              width={60}
              height={60}
              rx={12}
              fill={C.accent}
              fillOpacity={0.2}
              stroke={C.accent}
            />
            <Text x={20 + i * 80 + 30} y={200} anchor="middle" family={MONO} size={12} fill={C.muted}>
              {p}
            </Text>
          </Appear>
        ))}
      </Cell>

      <Cell x={810} y={40} label="<Rings> + <Image>">
        <Rings x={180} y={120} r={80} color={C.accent} muted={C.text} speed={3} />
        {/* For a GitHub avatar: src={await fetchImage("https://github.com/<user>.png?size=192")} */}
        <Image src={new URL("./avatar.png", import.meta.url)} x={132} y={72} width={96} height={96} radius={48} />
      </Cell>

      <Cell x={30} y={380} label="<DrawPath>">
        <DrawPath d="M60 120 l40 40 l80 -90" stroke={C.green} strokeWidth={10} progress={tween(frame, [20, 50])} />
        <DrawPath
          d="M200 160 C 230 40, 300 40, 320 160"
          stroke={C.warm}
          strokeWidth={4}
          progress={tween(frame, [40, 90])}
        />
        <DrawPath d="M40 210 h280" stroke={C.dim} strokeWidth={2} progress={tween(frame, [60, 120])} />
      </Cell>

      <Cell x={420} y={380} label="<ProgressBar>">
        <ProgressBar
          x={20}
          y={60}
          width={320}
          height={4}
          value={(frame % 120) / 119}
          marks={[0, 0.33, 0.66, 1]}
          fill={C.accent}
          track={C.dim}
        />
        <ProgressBar
          x={20}
          y={120}
          width={320}
          height={10}
          value={tween(frame, [10, 80])}
          fill={C.green}
          track={C.dim}
        />
        <ProgressBar
          x={20}
          y={170}
          width={320}
          height={10}
          value={1}
          start={tween(frame, [120, 200])}
          fill={C.warm}
          track={C.dim}
        />
      </Cell>

      <Cell x={810} y={380} label="<WindowFrame> + <Wipe>">
        <WindowFrame x={20} y={0} width={320} height={220} title="preview" font={{ family: SANS, size: 13 }}>
          <Text
            x={160}
            y={95}
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
            y={95}
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
      </Cell>

      {/* A full-frame wipe at the cut between "scenes". */}
      <Sequence from={112} durationInFrames={30}>
        <Wipe colors={[C.accent, "#ffffff", C.accent]} opacity={[1, 0.85, 1]} />
      </Sequence>
    </svg>
  );
}

export default defineComposition({
  component: Demo,
  width: W,
  height: H,
  fps: 30,
  durationInFrames: N,
  stillFrame: 100,
  title: "svgreel components demo",
  markers: [
    { frame: 10, label: "code" },
    { frame: 112, label: "wipe" },
  ],
  fonts: [
    ...fontsource("inter", { family: SANS, weights: [400, 800] }),
    ...fontsource("jetbrains-mono", { family: MONO, weights: [400] }),
  ],
});
