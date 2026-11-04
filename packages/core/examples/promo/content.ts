// Text of the svgreel promo, per language. index.tsx turns it into the animation.

export type Lang = "en" | "ja";

export interface Feature {
  title: string;
  /** Two lines in a card (about 200 px at 18 px); break them with "\n". */
  description: string;
}

export interface Copy {
  tagline: string;
  subline: string;
  write: { title: string; sub: string; preview: string };
  compile: { title: string; sub: string; points: string[] };
  features: { title: string; items: [Feature, Feature, Feature, Feature] };
  outro: { title: string; sub: string };
}

export const repo = "github.com/SegaraRai/svgreel";

/**
 * The write scene's formula: React's `UI = f(state)` turns into `SVG = f(time)`. Each pair must
 * have the same total length (shown in a monospace font, the ")" stays put).
 */
export const formula = { from: ["UI", "state"], to: ["SVG", "time"] } as const;

/**
 * Same code in every language: it is what users would type. The preview next to it runs this
 * very component (`Hello` in index.tsx, plus position and colors), so keep the two in step.
 */
export const code = [
  "function Hello() {",
  "  const frame = useCurrentFrame();",
  "  const { fps } = useVideoConfig();",
  "  const pop = charAnimations.pop({ frame, fps });",
  "  return (",
  "    <Text size={80} weight={800} charStyle={pop}>",
  "      Hello",
  "    </Text>",
  "  );",
  "}",
];

/** The CSS the compile scene "outputs" for the ball in the film strip. */
export const css = [
  "@keyframes k0 {",
  "  0%   { transform: translateX(0px) }",
  "  60%  { transform: translateX(96px) }",
  "  100% { transform: translateX(110px) }",
  "}",
];

export const terminal = [
  { command: "pnpm add svgreel react react-dom" },
  { command: "pnpm svgreel build" },
  { output: "  dist/hello/hello.svg" },
  { output: "  dist/hello/hello.still.svg" },
  { output: "  dist/index.html  (preview)" },
];

export const copy: Record<Lang, Copy> = {
  en: {
    tagline: "Motion graphics as React components.",
    subline: "Compiled to self-contained animated SVG.",
    write: {
      title: "Write it in React",
      sub: "Frame number in, picture out.",
      preview: "preview",
    },
    compile: {
      title: "Compile to CSS keyframes",
      sub: "Every frame is rendered, diffed and folded into @keyframes.",
      points: ["No JavaScript", "No web fonts", "Works in <img>"],
    },
    features: {
      title: "Everything a README banner needs",
      items: [
        { title: "Outlined text", description: "Any font, any script. Glyphs become paths." },
        { title: "Components", description: "Code, terminals,\ncounters and more." },
        { title: "Variants", description: "Dark, light and languages from one source." },
        { title: "Beat sync", description: "Time your motion to music." },
      ],
    },
    outro: {
      title: "Make yours",
      sub: "or start from svgreel-template",
    },
  },
  ja: {
    tagline: "React コンポーネントでモーショングラフィックス",
    subline: "アニメーション SVG ファイルにコンパイル",
    write: {
      title: "React で書く",
      sub: "フレーム番号を受け取って、画像を返すだけ",
      preview: "プレビュー",
    },
    compile: {
      title: "CSS キーフレームにコンパイル",
      sub: "全フレームを描いて差分を取り、@keyframes に畳み込みます",
      points: ["JavaScript なし", "Web フォントなし", "<img> でそのまま動作"],
    },
    features: {
      title: "README バナーに必要なものを、ひと通り",
      items: [
        { title: "アウトライン文字", description: "日本語も含め、\n文字をパスに変換" },
        { title: "コンポーネント", description: "コード、ターミナル、\nカウンターなど" },
        { title: "バリアント", description: "テーマも言語も、\n一つのソースから" },
        { title: "音ハメ", description: "音楽に\n合わせて動かせる" },
      ],
    },
    outro: {
      title: "あなたの SVG を",
      sub: "または svgreel-template から",
    },
  },
};
