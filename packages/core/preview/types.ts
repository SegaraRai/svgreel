export interface Output {
  variant: Readonly<Record<string, string>> & { readonly motion: string };
  /** False for motion "still". */
  animated: boolean;
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
