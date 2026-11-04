/** Links and shared text for the page. */
export const REPO = "https://github.com/SegaraRai/svgreel";
export const TEMPLATE_REPO = "https://github.com/SegaraRai/svgreel-template";
export const NPM = "https://www.npmjs.com/package/svgreel";
export const DOCS = `${REPO}/tree/main/packages/core/docs`;

export const TAGLINE = "Motion graphics as React components, compiled into self-contained animated SVGs.";
export const DESCRIPTION =
  "svgreel turns React components into animated SVGs that work in a GitHub README: CSS keyframes for motion, glyph outlines for text, no JavaScript and no web fonts.";

/** The README promo in the viewer's language, picked by apps/localize (see the root README). */
const PROMO_LANGS = "en%2Cja%2Czh-CN%2Czh-TW%2Cko%2Ces%2Cpt%2Cfr%2Cde%2Cru";
export const promo = (theme: "light" | "dark", still: boolean) =>
  `https://svgreel-localize.roundtrip.dev/github/SegaraRai/svgreel/assets/promo-${theme}-%7Blang%7D${still ? ".still" : ""}.svg?langs=${PROMO_LANGS}`;
