// Text of the svgreel promo, per language. index.tsx turns it into the animation.

/**
 * Output languages, in the order localize should prefer them (a bare "zh" picks zh-CN). Plain
 * tags where one text fits the region variants: "pt" also serves pt-PT, "es" every Spanish.
 */
export const LANGS = ["en", "ja", "zh-CN", "zh-TW", "ko", "es", "pt", "fr", "de", "ru"] as const;
export type Lang = (typeof LANGS)[number];

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
  /** The outlined-text card's demo: Latin plus a character of another script. */
  sample: string;
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
    sample: "Aa あ",
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
    sample: "Aa あ",
  },
  "zh-CN": {
    tagline: "用 React 组件制作动态图形",
    subline: "编译为 SVG 动画文件",
    write: {
      title: "用 React 编写",
      sub: "传入帧号，返回画面",
      preview: "预览",
    },
    compile: {
      title: "编译为 CSS 关键帧",
      sub: "逐帧渲染并比较差异，合并为 @keyframes",
      points: ["无需 JavaScript", "无需 Web 字体", "放进 <img> 就能播放"],
    },
    features: {
      title: "README 横幅所需的一切",
      items: [
        { title: "文字转路径", description: "中文也没问题，\n不依赖任何字体" },
        { title: "组件", description: "代码块、终端、\n计数器等" },
        { title: "变体", description: "主题与语言，\n共用一份源码" },
        { title: "音乐卡点", description: "让动画\n踩准节拍" },
      ],
    },
    outro: {
      title: "做出你的 SVG",
      sub: "或从 svgreel-template 开始",
    },
    sample: "Aa 字",
  },
  "zh-TW": {
    tagline: "用 React 元件製作動態圖像",
    subline: "編譯成 SVG 動畫檔案",
    write: {
      title: "用 React 撰寫",
      sub: "傳入影格編號，回傳畫面",
      preview: "預覽",
    },
    compile: {
      title: "編譯成 CSS 關鍵影格",
      sub: "逐格算繪並比對差異，整合成 @keyframes",
      points: ["不需要 JavaScript", "不需要網頁字型", "放進 <img> 就能播放"],
    },
    features: {
      title: "README 橫幅需要的一切",
      items: [
        { title: "文字轉路徑", description: "中文也沒問題，\n不依賴任何字型" },
        { title: "元件", description: "程式碼、終端機、\n計數器等" },
        { title: "變體", description: "主題與語言，\n共用一份原始碼" },
        { title: "節拍同步", description: "讓動畫\n踩準音樂節拍" },
      ],
    },
    outro: {
      title: "做出你的 SVG",
      sub: "或從 svgreel-template 開始",
    },
    sample: "Aa 字",
  },
  ko: {
    tagline: "React 컴포넌트로 만드는 모션 그래픽",
    subline: "애니메이션 SVG 파일로 컴파일",
    write: {
      title: "React로 작성",
      sub: "프레임 번호를 받아 이미지를 반환하면 끝",
      preview: "미리보기",
    },
    compile: {
      title: "CSS 키프레임으로 컴파일",
      sub: "모든 프레임을 렌더링하고, 바뀐 부분만 @keyframes로",
      points: ["JavaScript 없음", "웹 폰트 없음", "<img>에서 그대로 동작"],
    },
    features: {
      title: "README 배너에 필요한 모든 것",
      items: [
        { title: "아웃라인 텍스트", description: "한글도 문제없이\n글자를 패스로 변환" },
        { title: "컴포넌트", description: "코드, 터미널,\n카운터 등" },
        { title: "배리언트", description: "테마도 언어도\n하나의 소스로" },
        { title: "비트 싱크", description: "음악 박자에\n맞춰 움직이기" },
      ],
    },
    outro: {
      title: "나만의 SVG 만들기",
      sub: "또는 svgreel-template으로 시작하기",
    },
    sample: "Aa 한",
  },
  es: {
    tagline: "Motion graphics como componentes de React.",
    subline: "Compilados a SVG animado y autónomo.",
    write: {
      title: "Escríbelo en React",
      sub: "Entra un número de fotograma, sale una imagen.",
      preview: "vista previa",
    },
    compile: {
      title: "Compila a keyframes de CSS",
      sub: "Cada fotograma se renderiza, se compara y se condensa en @keyframes.",
      points: ["Sin JavaScript", "Sin fuentes web", "Funciona en <img>"],
    },
    features: {
      title: "Todo lo que necesita un banner de README",
      items: [
        { title: "Texto vectorizado", description: "Cualquier fuente,\ncualquier alfabeto." },
        { title: "Componentes", description: "Código, terminales,\ncontadores y más." },
        { title: "Variantes", description: "Temas e idiomas\ncon un solo código." },
        { title: "Al compás", description: "Anima al ritmo\nde tu música." },
      ],
    },
    outro: {
      title: "Crea el tuyo",
      sub: "o empieza con svgreel-template",
    },
    sample: "Aa あ",
  },
  pt: {
    tagline: "Motion graphics como componentes React.",
    subline: "Compilados em SVG animado e autocontido.",
    write: {
      title: "Escreva em React",
      sub: "Entra o número do quadro, sai a imagem.",
      preview: "prévia",
    },
    compile: {
      title: "Compile para keyframes CSS",
      sub: "Cada quadro é renderizado, comparado e condensado em @keyframes.",
      points: ["Sem JavaScript", "Sem fontes web", "Funciona em <img>"],
    },
    features: {
      title: "Tudo o que um banner de README precisa",
      items: [
        { title: "Texto em curvas", description: "Qualquer fonte,\nqualquer alfabeto." },
        { title: "Componentes", description: "Código, terminais,\ncontadores e mais." },
        { title: "Variantes", description: "Temas e idiomas\ncom um só código." },
        { title: "No ritmo", description: "Sincronize a animação\ncom a música." },
      ],
    },
    outro: {
      title: "Crie o seu",
      sub: "ou comece pelo svgreel-template",
    },
    sample: "Aa あ",
  },
  fr: {
    tagline: "Le motion design en composants React.",
    subline: "Compilé en SVG animé et autonome.",
    write: {
      title: "Codez en React",
      sub: "Numéro de frame en entrée, image en sortie.",
      preview: "aperçu",
    },
    compile: {
      title: "Compilez en keyframes CSS",
      sub: "Chaque frame est rendue, comparée puis condensée en @keyframes.",
      points: ["Zéro JavaScript", "Zéro police web", "Fonctionne dans <img>"],
    },
    features: {
      title: "Tout ce qu'il faut pour une bannière README",
      items: [
        { title: "Texte vectorisé", description: "Toutes les polices,\ntoutes les écritures." },
        { title: "Composants", description: "Code, terminaux,\ncompteurs et plus." },
        { title: "Variantes", description: "Thèmes et langues\nd'une seule source." },
        { title: "Synchro musicale", description: "Animez au rythme\nde votre musique." },
      ],
    },
    outro: {
      title: "Créez le vôtre",
      sub: "ou partez de svgreel-template",
    },
    sample: "Aa あ",
  },
  de: {
    tagline: "Motion Graphics als React-Komponenten.",
    subline: "Kompiliert zu eigenständigen animierten SVGs.",
    write: {
      title: "In React schreiben",
      sub: "Frame-Nummer rein, Bild raus.",
      preview: "Vorschau",
    },
    compile: {
      title: "Zu CSS-Keyframes kompilieren",
      sub: "Jeder Frame wird gerendert, verglichen und zu @keyframes verdichtet.",
      points: ["Kein JavaScript", "Keine Webfonts", "Läuft in <img>"],
    },
    features: {
      title: "Alles, was ein README-Banner braucht",
      items: [
        { title: "Text als Pfade", description: "Jede Schriftart,\njedes Schriftsystem." },
        { title: "Komponenten", description: "Code, Terminals,\nZähler und mehr." },
        { title: "Varianten", description: "Themes und Sprachen\naus einer Quelle." },
        { title: "Im Takt", description: "Animation passend\nzur Musik." },
      ],
    },
    outro: {
      title: "Erstelle dein eigenes",
      sub: "oder starte mit svgreel-template",
    },
    sample: "Aa あ",
  },
  ru: {
    tagline: "Моушн-графика на React-компонентах.",
    subline: "Компилируется в автономный анимированный SVG.",
    write: {
      title: "Пишите на React",
      sub: "На входе номер кадра, на выходе картинка.",
      preview: "превью",
    },
    compile: {
      title: "Компиляция в CSS keyframes",
      sub: "Каждый кадр рендерится, сравнивается и сворачивается в @keyframes.",
      points: ["Без JavaScript", "Без веб-шрифтов", "Работает в <img>"],
    },
    features: {
      title: "Всё, что нужно баннеру для README",
      items: [
        { title: "Текст в кривых", description: "Любой шрифт,\nлюбая письменность." },
        { title: "Компоненты", description: "Код, терминалы,\nсчётчики и прочее." },
        { title: "Варианты", description: "Темы и языки\nиз одного исходника." },
        { title: "В такт музыке", description: "Синхронизация\nанимации с музыкой." },
      ],
    },
    outro: {
      title: "Сделайте свой",
      sub: "или начните с svgreel-template",
    },
    sample: "Aa Я",
  },
};
