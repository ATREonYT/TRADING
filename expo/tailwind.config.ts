import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F2EFE7",
        panel: "#FFFFFF",
        ink: "#23201A",
        muted: "#6F6A5E",
        line: "#E4DFD3",
        accent: "#D9480F",
        "accent-soft": "#FBE9E0",
        verify: "#2B8A3E",
        gold: "#B08D2E",
        // gold fails WCAG AA as small text on paper (2.7:1) — use this for
        // gold TEXT, keep `gold` for dots, borders and fills
        "gold-deep": "#7A611F",
      },
      fontFamily: {
        display: ["Iowan Old Style", "Palatino Linotype", "Palatino", "Georgia", "serif"],
        body: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(35,32,26,0.06), 0 4px 12px rgba(35,32,26,0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
