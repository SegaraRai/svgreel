// The motion building blocks: scene sequencing, loops, masks, camera moves, paths and a terminal.
// Two scenes run in a <Series>; the trailing transition carries the last one back to the first.

import type { ReactNode } from "react";
import {
  ArcProgress,
  Camera,
  defineComposition,
  DrawPath,
  FollowPath,
  fontsource,
  Marquee,
  noise1D,
  oscillate,
  Pill,
  pillWidth,
  random,
  Reveal,
  round,
  Series,
  Terminal,
  Text,
  TextRotator,
  textRotatorWidth,
  transitions,
  tween,
  useCurrentFrame,
  type TerminalTheme,
} from "svgreel";

const W = 1200;
const H = 720;
const SCENE = 130;
const CUT = 10;
const N = SCENE * 2 - CUT * 2;
const SANS = "Inter";
const MONO = "JetBrains Mono";

const C = {
  bg: "#0b0f19",
  panel: "#0f1420",
  text: "#e6edf3",
  muted: "#8b95a5",
  dim: "#2a3242",
  accent: "#7aa2ff",
  warm: "#f0a66a",
  green: "#7ee2a8",
};

const TERM: TerminalTheme = {
  background: "#0d1117",
  bar: "#161b22",
  border: C.dim,
  text: C.text,
  prompt: C.green,
  accent: C.accent,
  title: C.muted,
};

function Cell({ x, y, label, children }: { x: number; y: number; label: string; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={360} height={300} rx={16} fill={C.panel} stroke={C.dim} />
      <Text x={20} y={32} family={MONO} size={13} fill={C.muted}>
        {label}
      </Text>
      <g transform="translate(0 50)">{children}</g>
    </g>
  );
}

function Rotator() {
  const frame = useCurrentFrame();
  const style = { family: SANS, weight: 800, size: 30 };
  const words = ["tools", "games", "websites"];
  const timing = { start: 10, hold: 30, transition: 12 };
  const w = textRotatorWidth(frame, words, style, timing);
  return (
    <g>
      <Text x={20} y={90} {...style} fill={C.text}>
        I build
      </Text>
      <TextRotator x={150} y={90} words={words} {...style} {...timing} fill={C.accent} />
      <g style={{ transform: `translateX(${round(w)}px)` }}>
        <Text x={156} y={90} {...style} fill={C.text}>
          .
        </Text>
      </g>
      <Text x={20} y={150} family={SANS} size={14} fill={C.muted}>
        The period follows the word's width.
      </Text>
    </g>
  );
}

function Logos() {
  const pill = { family: SANS, size: 14, weight: 400 };
  const tags = ["react", "svg", "css", "fonts"];
  let at = 0;
  const items = tags.map((t) => {
    const x = at;
    at += pillWidth({ text: t, height: 30, ...pill }) + 10;
    return { t, x };
  });
  return (
    <g>
      {[0, 1].map((row) => (
        <Marquee
          key={row}
          x={20}
          y={40 + row * 60}
          width={320}
          height={34}
          itemWidth={at - 10}
          gap={10}
          speed={row ? 0.8 : 1.4}
          direction={row ? "right" : "left"}
        >
          {items.map(({ t, x }) => (
            <Pill key={t} x={x} y={2} text={t} {...pill} height={30} fill="#162033" stroke={C.dim} color={C.text} />
          ))}
        </Marquee>
      ))}
    </g>
  );
}

function SceneA() {
  return (
    <g>
      <Cell x={30} y={40} label="<TextRotator>">
        <Rotator />
      </Cell>
      <Cell x={420} y={40} label="<Marquee>">
        <Logos />
      </Cell>
      <Cell x={810} y={40} label="random() / noise1D()">
        <Stars />
      </Cell>
      <g transform="translate(30 380)">
        <Terminal
          width={1140}
          height={300}
          title="zsh"
          font={{ family: MONO, size: 15 }}
          theme={TERM}
          start={8}
          speed={1}
          lines={[
            { command: "pnpm add svgreel" },
            { output: "Packages: +4", color: C.muted },
            { output: "Done in 1.2s" },
            { command: "pnpm build" },
            { output: "+ profile  212 ms, 240 frames", color: C.green },
            { output: "    dist/profile/profile-dark.svg  38.2 KB", color: C.muted },
            { output: "    dist/profile/profile-light.svg  38.2 KB", color: C.muted },
            { output: "" },
            { output: "Preview: file:///…/dist/index.html", color: C.accent },
          ]}
        />
      </g>
    </g>
  );
}

function Stars() {
  const frame = useCurrentFrame();
  return (
    <g>
      {Array.from({ length: 24 }, (_, i) => {
        const x = 20 + random(`star-${i}-x`) * 320;
        const y = 10 + random(`star-${i}-y`) * 220;
        // Wobble on loop-length noise, so it loops without a jump.
        const dy = noise1D((frame / N) * 6, `star-${i}`, 6) * 8;
        return (
          <circle
            key={i}
            cx={round(x)}
            cy={round(y)}
            r={round(1.5 + random(`star-${i}-r`) * 3)}
            fill={i % 3 ? C.text : C.warm}
            style={{ transform: `translateY(${round(dy)}px)`, opacity: round(0.4 + random(`star-${i}-o`) * 0.6) }}
          />
        );
      })}
    </g>
  );
}

const ROUTE = "M30 200C90 60 170 220 230 110S320 40 330 150";

function SceneB() {
  const frame = useCurrentFrame();
  const p = tween(frame, [10, 100], [0, 1]);
  const bob = oscillate(frame, 60, N) * 6;
  return (
    <g>
      <Cell x={30} y={40} label="<Reveal>">
        {["Lines rise", "out of a mask,", "one by one."].map((line, i) => (
          <Reveal
            key={i}
            x={20}
            y={20 + i * 50}
            width={320}
            height={44}
            progress={tween(frame, [10 + i * 8, 34 + i * 8])}
          >
            <Text y={34} family={SANS} weight={800} size={30} fill={C.text}>
              {line}
            </Text>
          </Reveal>
        ))}
        <Reveal x={20} y={190} width={300} height={6} progress={tween(frame, [40, 80])} direction="right" mode="wipe">
          <rect width={300} height={6} rx={3} fill={C.accent} />
        </Reveal>
      </Cell>
      <Cell x={420} y={40} label="<Camera>">
        <svg width={360} height={250} overflow="hidden">
          <Camera
            width={360}
            height={250}
            duration={24}
            shots={[
              { at: 0, rect: [0, 0, 360, 250] },
              { at: 20, rect: [40, 30, 120, 80] },
              { at: 70, rect: [200, 140, 120, 80] },
            ]}
          >
            {Array.from({ length: 6 }, (_, i) => (
              <rect
                key={i}
                x={20 + (i % 3) * 110}
                y={20 + Math.floor(i / 3) * 110}
                width={100}
                height={100}
                rx={12}
                fill="#162033"
                stroke={C.dim}
              />
            ))}
            <circle cx={100} cy={70} r={20} fill={C.accent} />
            <circle cx={260} cy={180} r={20} fill={C.warm} />
          </Camera>
        </svg>
      </Cell>
      <Cell x={810} y={40} label="<ArcProgress>">
        <ArcProgress cx={100} cy={120} r={70} value={p * 0.82} strokeWidth={14} stroke={C.accent} track={C.dim} />
        <ArcProgress
          cx={260}
          cy={120}
          r={60}
          value={p * 0.3}
          startAngle={-135}
          sweep={270}
          strokeWidth={10}
          stroke={C.warm}
          track={C.dim}
        />
        <ArcProgress
          cx={260}
          cy={120}
          r={60}
          from={p * 0.3}
          value={p * 0.55}
          startAngle={-135}
          sweep={270}
          strokeWidth={10}
          stroke={C.green}
          strokeLinecap="butt"
        />
        <Text x={100} y={120} anchor="middle" baseline="middle" family={SANS} weight={800} size={22} fill={C.text}>
          82%
        </Text>
      </Cell>
      <Cell x={30} y={380} label="<FollowPath> / pointOnPath()">
        <path d={ROUTE} fill="none" stroke={C.dim} strokeWidth={2} strokeDasharray="4 6" />
        <DrawPath d={ROUTE} progress={p} stroke={C.accent} strokeWidth={3} />
        <FollowPath d={ROUTE} progress={p} rotate>
          <polygon points="-10,-7 12,0 -10,7" fill={C.text} />
        </FollowPath>
      </Cell>
      <Cell x={420} y={380} label="oscillate()">
        <g style={{ transform: `translateY(${round(bob)}px)` }}>
          <circle cx={180} cy={110} r={40} fill={C.accent} />
        </g>
        <Text x={180} y={220} anchor="middle" family={SANS} size={14} fill={C.muted}>
          Period snapped to fit the loop
        </Text>
      </Cell>
      <Cell x={810} y={380} label="<Series>">
        <Text x={20} y={60} family={SANS} size={15} fill={C.text} maxWidth={320} lineHeight={24}>
          Two scenes, cross-faded at the cut and slid back to the first across the loop seam.
        </Text>
      </Cell>
    </g>
  );
}

function Demo() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <rect width={W} height={H} fill={C.bg} />
      <Series>
        <Series.Scene duration={SCENE}>
          <rect width={W} height={H} fill={C.bg} />
          <SceneA />
        </Series.Scene>
        <Series.Transition duration={CUT} presentation={transitions.fade()} />
        <Series.Scene duration={SCENE}>
          <rect width={W} height={H} fill={C.bg} />
          <SceneB />
        </Series.Scene>
        <Series.Transition duration={CUT} presentation={transitions.slide("left")} />
      </Series>
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
  title: "svgreel motion demo",
  markers: [
    { frame: 0, label: "scene A" },
    { frame: SCENE - CUT, label: "scene B" },
  ],
  fonts: [
    ...fontsource("inter", { family: SANS, weights: [400, 800] }),
    ...fontsource("jetbrains-mono", { family: MONO, weights: [400] }),
  ],
});
