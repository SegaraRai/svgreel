import type { CSSProperties } from "react";

import { round } from "../animation/helpers.js";
import { useVideoConfig } from "../timeline.js";
import { useSvgId } from "./useSvgId.js";

export interface GlowOrbProps {
  color: string;
  r?: number;
  /** Peak opacity at the centre. */
  intensity?: number;
  /** Animate position/opacity through style (e.g. `transform: translate(…)`, `opacity`). */
  style?: CSSProperties;
}

/** A soft radial glow centred on (0, 0). Move it with `style.transform`. */
export function GlowOrb({ color, r = 420, intensity = 0.4, style }: GlowOrbProps) {
  const id = useSvgId("orb");
  return (
    <g>
      <defs>
        {/* Gaussian-like falloff: a single mid stop leaves a visible knee that reads as a halo. */}
        <radialGradient id={id}>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((o) => (
            <stop
              key={o}
              offset={o}
              stopColor={color}
              stopOpacity={round(intensity * Math.exp(-4.5 * o * o) * (1 - o))}
            />
          ))}
        </radialGradient>
      </defs>
      <circle r={r} fill={`url(#${id})`} style={style} />
    </g>
  );
}

export interface DotGridProps {
  color: string;
  /** Distance between dots in px. */
  spacing?: number;
  radius?: number;
  opacity?: number;
  /** Fade the grid out towards the bottom-right. Default true. */
  fade?: boolean;
  width?: number;
  height?: number;
}

/** A dotted backdrop filling the frame. */
export function DotGrid({
  color,
  spacing = 24,
  radius = 1.2,
  opacity = 0.55,
  fade = true,
  width,
  height,
}: DotGridProps) {
  const config = useVideoConfig();
  const w = width ?? config.width;
  const h = height ?? config.height;
  const pattern = useSvgId("dots");
  const grad = useSvgId("dotsfade");
  const mask = useSvgId("dotsmask");
  return (
    <g>
      <defs>
        <pattern id={pattern} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
          <circle cx={radius + 1} cy={radius + 1} r={radius} fill={color} opacity={opacity} />
        </pattern>
        {fade && (
          <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0.9} />
            <stop offset="1" stopColor="#fff" stopOpacity={0.15} />
          </linearGradient>
        )}
        {fade && (
          <mask id={mask}>
            <rect width={w} height={h} fill={`url(#${grad})`} />
          </mask>
        )}
      </defs>
      <rect width={w} height={h} fill={`url(#${pattern})`} mask={fade ? `url(#${mask})` : undefined} />
    </g>
  );
}
