// Edit this file to describe yourself and your projects; index.tsx turns it into the animation.
// Text may include Japanese (Noto Sans JP is registered as a fallback font).

export interface Project {
  /** Display name. Long names shrink to fit. */
  name: string;
  /** Shown after `handle` in the window bar while this project is on screen. */
  path: string;
  /** Short category label, e.g. "Library", "CLI", "Website". */
  kind: string;
  /** Up to two lines; wraps automatically. */
  description: string;
  tags: string[];
  /** Right-hand card: a code snippet typed out (≤ 7 lines, ≤ 44 columns)… */
  code?: { file: string; lang: string; lines: string[] };
  /** …or a few numbers that roll in. */
  stats?: { label: string; value: string }[];
  /** Logo: an SVG path in a 100 × 100 box (stroked, drawn on), or omit for a monogram. */
  icon?: string;
  /** Brand color, or a pair tuned per theme. */
  accent: string | { dark: string; light: string };
}

export const profile = {
  greeting: "Hi, I'm",
  name: "Your Name",
  tagline: "I build tools for the web.\nThis banner is a React component.",
  handle: "github.com/your-handle",
  /** Shown in the avatar circle. */
  initials: "YN",
  outro: "More on GitHub",
  projects: [
    {
      name: "Project One",
      path: "/project-one",
      kind: "Library",
      description: "A one-line pitch for your library.\nWhat makes it worth a star.",
      tags: ["TypeScript", "React"],
      code: {
        file: "example.ts",
        lang: "TypeScript",
        lines: ['import { thing } from "project-one";', "", "const result = thing({", "  fast: true,", "});"],
      },
      icon: "M22 70 L50 26 L78 70 Z",
      accent: { dark: "#8fb3ff", light: "#2f5bd3" },
    },
    {
      name: "Project Two",
      path: "/project-two",
      kind: "CLI",
      description: "Describe the problem it solves\nin two short lines.",
      tags: ["Rust", "CLI"],
      code: {
        file: "terminal",
        lang: "sh",
        lines: ["$ cargo install project-two", "$ project-two init", "# ready in 0.2s"],
      },
      accent: { dark: "#f4708d", light: "#d1244f" },
    },
    {
      name: "Project Three",
      path: "/project-three",
      kind: "Website",
      description: "A site people use every day,\nupdated automatically.",
      tags: ["Astro", "GitHub Actions"],
      stats: [
        { label: "stars", value: "1,284" },
        { label: "users / mo", value: "42k" },
      ],
      icon: "M30 50 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 M50 22 v8 M50 70 v8 M22 50 h8 M70 50 h8",
      accent: { dark: "#f0a66a", light: "#b45b29" },
    },
  ] satisfies Project[] as Project[],
};
