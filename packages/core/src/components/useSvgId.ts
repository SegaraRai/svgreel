import { useId } from "react";

/**
 * A document-unique id for <clipPath>, <linearGradient>, <mask>, etc. Stable across frames
 * because every frame renders the same element tree.
 *
 *   const id = useSvgId("glow");  // <radialGradient id={id}> … fill={`url(#${id})`}
 */
export function useSvgId(prefix = "u"): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}
