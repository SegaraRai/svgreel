import { useEffect, useRef } from "react";
import { style } from "stillwind/react";

import { clock } from "./clock";

/**
 * Renders SVG markup inside a shadow root: its <style> (class names, @keyframes, ids) stays
 * isolated from the other SVGs on the page, and its animations can be driven by the clock.
 */
export function SvgView({ svg, animated }: { svg: string; animated: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current!;
    const root = el.shadowRoot ?? el.attachShadow({ mode: "open" });
    // The preview always plays; the reduced-motion fallback is checked through the still files.
    const markup = svg.replace(/@media \(prefers-reduced-motion:reduce\)\{[^}]*\}\}/, "");
    root.innerHTML = `<style>:host{display:block}svg{display:block;width:100%;height:auto}</style>${markup}`;
    if (!animated) {
      return;
    }
    return clock.register(root.getAnimations());
  }, [svg, animated]);
  // Clicking an animated SVG plays or pauses, like the transport's button.
  return (
    <div
      ref={host}
      data-animated={animated || undefined}
      title={animated ? "Click to play / pause" : undefined}
      {...style("p-4 data-animated:cursor-pointer")}
      onClick={animated ? () => clock.set({ playing: !clock.playing }) : undefined}
    />
  );
}
