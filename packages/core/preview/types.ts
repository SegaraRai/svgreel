import type { ParamInfo } from "../src/params";

export interface Output {
  variant: Readonly<Record<string, string>> & { readonly motion: string };
  /** False for motion "still". */
  animated: boolean;
  /** Param values this file was built with. */
  params: Readonly<Record<string, string | number | boolean>>;
  file: string;
  bytes: number;
  svg: string;
}

export interface CompositionData {
  name: string;
  title?: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  stillFrame: number;
  markers: {
    frame: number;
    label: string;
  }[];
  /** Variant keys and their values, in file-name order (motion last). */
  variants: [string, string[]][];
  params: ParamInfo[];
  /** Param keys set with --param. */
  overridden: string[];
  /** Audio played in sync with the timeline; `file` is relative to the preview page. */
  audio?: { file: string; offset: number };
  outputs: Output[];
  stats?: {
    frames: number;
    elements: number;
    animatedElements: number;
    tracks: number;
    keyframes: number;
    ms: number;
  };
  error?: string;
  builtAt: string;
}

export interface PreviewData {
  buildId: string;
  compositions: CompositionData[];
}

declare global {
  interface Window {
    __SVGREEL__?: PreviewData;
  }
}
