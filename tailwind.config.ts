import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B2A41",        // deep slate-navy: chalkboard ink
        inkSoft: "#33455E",
        paper: "#F7F6F1",      // ledger paper
        card: "#FFFFFF",
        rule: "#E2DFD4",       // faint ledger rule lines
        brass: "#9A7B2D",      // varsity brass
        brassSoft: "#C9AE6A",
        signal: "#2E7D5B",     // positive
        alert: "#B3422E",      // negative
        wait: "#8A8473",       // neutral/pending
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
