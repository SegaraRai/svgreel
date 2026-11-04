import type { CSSProperties } from "react";

import { loadImage } from "../image.js";
import { useSvgId } from "./useSvgId.js";

export interface ImageProps {
  /** A file path (relative to the project root), a file URL, or a `data:` URI from `fetchImage()`. */
  src: string | URL;
  x?: number;
  y?: number;
  width: number;
  height: number;
  /** How the image fills the box: crop to cover it (default), fit inside it, or stretch. */
  fit?: "cover" | "contain" | "fill";
  /** Corner radius. Half the size of a square box gives a circle (avatars). */
  radius?: number;
  /** Applied to the wrapping `<g>`, so the clip moves with the image. Animate opacity/transform here. */
  style?: CSSProperties;
}

const ASPECT = {
  cover: "xMidYMid slice",
  contain: "xMidYMid meet",
  fill: "none",
} as const;

/**
 * A raster (or SVG) image, embedded in the output as a `data:` URI.
 *
 *   <Image src="images/screenshot.png" x={40} y={40} width={320} height={200} radius={12} />
 *   <Image src={avatar} width={96} height={96} radius={48} />  // avatar = await fetchImage(url)
 */
export function Image({ src, x = 0, y = 0, width, height, fit = "cover", radius = 0, style }: ImageProps) {
  const id = useSvgId("img");
  const href = loadImage(src);
  const r = Math.min(radius, width / 2, height / 2);
  return (
    <g style={style}>
      {r > 0 && (
        <clipPath id={id}>
          <rect x={x} y={y} width={width} height={height} rx={r} />
        </clipPath>
      )}
      <image
        href={href}
        x={x}
        y={y}
        width={width}
        height={height}
        preserveAspectRatio={ASPECT[fit]}
        clipPath={r > 0 ? `url(#${id})` : undefined}
      />
    </g>
  );
}
