// The motion building blocks: scene sequencing, loops, masks, camera moves, paths and a terminal.
// Two scenes run in a <Series>; the trailing transition carries the last one back to the first.
// The header stays put while the cards below it change scenes.

import {
  ArcProgress,
  Camera,
  defineComposition,
  DrawPath,
  FollowPath,
  Marquee,
  measureText,
  noise1D,
  oscillate,
  Pill,
  pillWidth,
  random,
  Reveal,
  round,
  Series,
  seriesTimeline,
  Terminal,
  Text,
  TextRotator,
  textRotatorWidth,
  transitions,
  tween,
  useCurrentFrame,
  type TerminalTheme,
} from "svgreel";
import { Backdrop, C, Card, CARD, cell, H, MONO, SANS, showcaseFonts, W } from "../_shared/showcase.js";

const SCENE = 136;
const CUT = 16;
const N = SCENE * 2 - CUT * 2;
/** Both cuts move the same way: the next scene comes in from the right and pushes the last one out. */
const PUSH = transitions.push("right");
/** Start frames of the scenes, for the markers. The first starts at -CUT: it enters across the loop seam. */
const TIMELINE = seriesTimeline([SCENE, { transition: CUT }, SCENE, { transition: CUT }]);

const TERM: TerminalTheme = {
  background: "#0c111c",
  bar: C.raised,
  border: C.border,
  text: C.text,
  prompt: C.green,
  accent: C.accent,
  title: C.muted,
};

function Rotator() {
  const frame = useCurrentFrame();
  const style = { family: SANS, weight: 800, size: 30 };
  const words = ["tools", "games", "websites"];
  const timing = { start: 10, hold: 30, transition: 12 };
  const w = textRotatorWidth(frame, words, style, timing);
  const at = 22 + measureText("I build ", style);
  return (
    <g>
      <Text x={22} y={100} {...style} fill={C.text}>
        I build
      </Text>
      <TextRotator x={at} y={100} words={words} {...style} {...timing} fill={C.accent} />
      <g style={{ transform: `translateX(${round(w)}px)` }}>
        <Text x={round(at + 1)} y={100} {...style} fill={C.text}>
          .
        </Text>
      </g>
      <Text x={22} y={200} family={SANS} size={13} fill={C.muted}>
        textRotatorWidth() moves the period with the word.
      </Text>
    </g>
  );
}

const ROWS = [
  { tags: ["react", "svg", "css", "fonts"], speed: 1.4, direction: "left", color: C.accent },
  { tags: ["keyframes", "outlines", "loops"], speed: 0.8, direction: "right", color: C.warm },
  { tags: ["themes", "languages", "params"], speed: 1.1, direction: "left", color: C.green },
] as const;

function Tickers() {
  const pill = { family: SANS, size: 14, weight: 400 };
  return (
    <g>
      {ROWS.map((row, r) => {
        let at = 0;
        const items = row.tags.map((t) => {
          const x = at;
          at += pillWidth({ text: t, height: 30, ...pill }) + 10;
          return { t, x };
        });
        return (
          <Marquee
            key={r}
            x={22}
            y={24 + r * 62}
            width={320}
            height={34}
            itemWidth={at - 10}
            gap={10}
            speed={row.speed}
            direction={row.direction}
          >
            {items.map(({ t, x }) => (
              <Pill
                key={t}
                x={x}
                y={2}
                text={t}
                {...pill}
                height={30}
                fill={row.color}
                fillOpacity={0.12}
                stroke={row.color}
                strokeOpacity={0.45}
                color={C.text}
              />
            ))}
          </Marquee>
        );
      })}
    </g>
  );
}

function Stars() {
  const frame = useCurrentFrame();
  return (
    <g>
      {Array.from({ length: 28 }, (_, i) => {
        const x = 24 + random(`star-${i}-x`) * 316;
        const y = 14 + random(`star-${i}-y`) * 200;
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

function SceneA() {
  const term = cell(0, 1);
  return (
    <g>
      <Card {...cell(0, 0)} label="<TextRotator>" note="words swap in place">
        <Rotator />
      </Card>
      <Card {...cell(1, 0)} label="<Marquee>" note="seamless ticker rows" color={C.warm}>
        <Tickers />
      </Card>
      <Card {...cell(2, 0)} label="random() / noise1D()" note="seeded, loop-safe" color={C.green}>
        <Stars />
      </Card>
      <g transform={`translate(${term.x} ${term.y})`}>
        <Terminal
          width={1128}
          height={CARD.h}
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

const ROUTE = "M32 190C92 50 172 210 232 100S322 30 332 140";
/** The camera's viewport: the card's content area, less a bottom margin. */
const VIEW = { w: CARD.w, h: CARD.h - CARD.head - 6 };

function SceneB() {
  const frame = useCurrentFrame();
  const p = tween(frame, [10, 100], [0, 1]);
  const bob = oscillate(frame, 60, N);
  return (
    <g>
      <Card {...cell(0, 0)} label="<Reveal>" note="masked line-by-line entry">
        {["Lines rise", "out of a mask,", "one by one."].map((line, i) => (
          <Reveal
            key={i}
            x={22}
            y={14 + i * 50}
            width={320}
            height={44}
            progress={tween(frame, [10 + i * 8, 34 + i * 8])}
          >
            <Text y={34} family={SANS} weight={800} size={30} fill={i === 2 ? C.accent : C.text}>
              {line}
            </Text>
          </Reveal>
        ))}
        <Reveal x={22} y={190} width={300} height={6} progress={tween(frame, [40, 80])} direction="right" mode="wipe">
          <rect width={300} height={6} rx={3} fill={C.accent} />
        </Reveal>
      </Card>
      <Card {...cell(1, 0)} label="<Camera>" note="pans and zooms between shots" color={C.warm}>
        <svg width={VIEW.w} height={VIEW.h} overflow="hidden">
          <Camera
            width={VIEW.w}
            height={VIEW.h}
            duration={24}
            shots={[
              { at: 0, rect: [0, 0, VIEW.w, VIEW.h] },
              { at: 20, rect: [44, 28, 120, 78] },
              { at: 70, rect: [204, 140, 120, 78] },
            ]}
          >
            {Array.from({ length: 6 }, (_, i) => (
              <rect
                key={i}
                x={22 + (i % 3) * 110}
                y={8 + Math.floor(i / 3) * 112}
                width={100}
                height={100}
                rx={12}
                fill={C.raised}
                stroke={C.dim}
              />
            ))}
            <circle cx={104} cy={67} r={20} fill={C.accent} />
            <circle cx={264} cy={179} r={20} fill={C.warm} />
          </Camera>
        </svg>
      </Card>
      <Card {...cell(2, 0)} label="<ArcProgress>" note="rings, gauges, segments" color={C.green}>
        <ArcProgress cx={102} cy={112} r={70} value={p * 0.82} strokeWidth={14} stroke={C.accent} track={C.dim} />
        <ArcProgress
          cx={262}
          cy={112}
          r={60}
          value={p * 0.3}
          startAngle={-135}
          sweep={270}
          strokeWidth={10}
          stroke={C.warm}
          track={C.dim}
        />
        <ArcProgress
          cx={262}
          cy={112}
          r={60}
          from={p * 0.3}
          value={p * 0.55}
          startAngle={-135}
          sweep={270}
          strokeWidth={10}
          stroke={C.green}
          strokeLinecap="butt"
        />
        <Text x={102} y={112} anchor="middle" baseline="middle" family={SANS} weight={800} size={22} fill={C.text}>
          82%
        </Text>
      </Card>
      <Card {...cell(0, 1)} label="<FollowPath>" note="rides a path, facing forward" color={C.pink}>
        <path d={ROUTE} fill="none" stroke={C.dim} strokeWidth={2} strokeDasharray="4 6" />
        <DrawPath d={ROUTE} progress={p} stroke={C.accent} strokeWidth={3} />
        <FollowPath d={ROUTE} progress={p} rotate>
          <polygon points="-10,-7 12,0 -10,7" fill={C.text} />
        </FollowPath>
      </Card>
      <Card {...cell(1, 1)} label="oscillate()" note="period snapped to the loop" color={C.warm}>
        {/* The shadow shrinks as the ball rises. */}
        <g transform="translate(182 196)">
          <ellipse
            rx={36}
            ry={6}
            fill="#000"
            fillOpacity={0.4}
            style={{ transform: `scaleX(${round(1 + bob * 0.3)})` }}
          />
        </g>
        <g style={{ transform: `translateY(${round(bob * 24)}px)` }}>
          <circle cx={182} cy={120} r={40} fill={C.accent} />
          <circle cx={168} cy={106} r={10} fill="#fff" fillOpacity={0.25} />
        </g>
      </Card>
      <Card {...cell(2, 1)} label="<Series>" note="scenes and transitions" color={C.green}>
        <Text x={22} y={40} family={SANS} size={15} fill={C.text} maxWidth={320} lineHeight={24}>
          Two scenes, each pushing the other out: once at the cut, and again across the loop seam.
        </Text>
        {["<Series.Scene>", "transitions.push()"].map((t, i) => (
          <g key={t} transform={`translate(${22 + i * 166} 150)`}>
            <rect width={154} height={56} rx={10} fill={C.raised} stroke={C.dim} />
            <Text x={77} y={33} anchor="middle" family={MONO} size={13} fill={i ? C.warm : C.accent}>
              {t}
            </Text>
          </g>
        ))}
      </Card>
    </g>
  );
}

function Animation() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <Backdrop title="Animation" subtitle="Scenes, loops, masks, cameras and paths" path="examples/animation" />
      <Series>
        <Series.Scene duration={SCENE}>
          <SceneA />
        </Series.Scene>
        <Series.Transition duration={CUT} presentation={PUSH} />
        <Series.Scene duration={SCENE}>
          <SceneB />
        </Series.Scene>
        <Series.Transition duration={CUT} presentation={PUSH} />
      </Series>
    </svg>
  );
}

export default defineComposition({
  component: Animation,
  width: W,
  height: H,
  fps: 30,
  durationInFrames: N,
  stillFrame: 90,
  title: "svgreel animation",
  markers: [
    { frame: 0, label: "scene A" },
    { frame: TIMELINE.scenes[1].start, label: "push to B" },
    { frame: N - CUT, label: "push to A" },
  ],
  fonts: showcaseFonts(),
});
