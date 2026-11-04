export type { FontSpec, TextStyle } from "./fonts.js";
export {
  defineComposition,
  Sequence,
  useCurrentFrame,
  useVariant,
  useVideoConfig,
  type Composition,
  type Marker,
  type VideoConfig,
} from "./timeline.js";
export { defineVariants, type PredefinedVariants, type Variant, type VariantAxes, type VariantOf } from "./variants.js";

export { charAnimations } from "./animation/charAnimations.js";
export { interpolateColors, mixColors, parseColor, withAlpha } from "./animation/color.js";
export { Easing, type EasingFn } from "./animation/easing.js";
export { blink, loopPeriod, oscillate, presence, pulse, round, tween } from "./animation/helpers.js";
export { interpolate, type Extrapolate, type InterpolateOptions } from "./animation/interpolate.js";
export { pathGeometry, pointOnPath, type PathGeometry, type PathPoint } from "./animation/path.js";
export { noise1D, noise2D, random } from "./animation/random.js";
export { measureSpring, spring, type SpringConfig } from "./animation/spring.js";
export { useSvgId } from "./components/useSvgId.js";
export { fontsource } from "./fontsource.js";
export { fetchImage, loadImage } from "./image.js";

export { Appear } from "./components/Appear.js";
export { ArcProgress, arcPath } from "./components/ArcProgress.js";
export { DotGrid, GlowOrb } from "./components/Backgrounds.js";
export { Camera, cameraRect, cameraTransform, type Rect, type Shot } from "./components/Camera.js";
export { CodeBlock, codeBlockHeight, highlight, type CodeTheme } from "./components/CodeBlock.js";
export { DrawPath } from "./components/DrawPath.js";
export { FollowPath } from "./components/FollowPath.js";
export { Image, type ImageProps } from "./components/Image.js";
export { Marquee, marqueeSpeed } from "./components/Marquee.js";
export { Once } from "./components/Once.js";
export { Pill, PillRow, pillWidth } from "./components/Pill.js";
export { ProgressBar } from "./components/ProgressBar.js";
export { Reveal } from "./components/Reveal.js";
export { Rings } from "./components/Rings.js";
export { Series, seriesTimeline, transitions, type Presentation, type SeriesSlot } from "./components/Series.js";
export { SlotCounter, slotCounterWidth } from "./components/SlotCounter.js";
export {
  fitFontSize,
  measureText,
  measureTextBlock,
  Text,
  type CharInfo,
  type TextBlock,
  type TextBlockStyle,
  type TextProps,
} from "./components/Text.js";
export { Terminal, terminalTimeline, type TerminalLine, type TerminalTheme } from "./components/Terminal.js";
export { rotatorState, TextRotator, textRotatorWidth, type RotatorTiming } from "./components/TextRotator.js";
export { Typewriter } from "./components/Typewriter.js";
export { WindowFrame } from "./components/WindowFrame.js";
export { Wipe } from "./components/Wipe.js";
