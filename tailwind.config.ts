import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark Mode (OLED) surfaces — deep violet-tinted night, layered elevation
        base: "#07060E",
        surface: "#0E0D1C",
        elevated: "#161430",
        overlay: "#1D1A3E",
        border: "#272352",
        // Text
        ink: "#F4F4FB",
        muted: "#A0A3C4",
        faint: "#6B6E96",
        // Brand (electric violet + cyan accent)
        primary: "#8B5CF6",
        "primary-deep": "#5B21B6",
        accent: "#22D3EE",
        // Market semantics (TradingView-aligned, colorblind-safe via fill/outline)
        up: "#26A69A",
        down: "#EF5350",
        warn: "#F59E0B",
      },
      fontFamily: {
        sans: ["var(--font-fira-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-fira-code)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
        glow: "0 0 14px -2px rgba(139,92,246,0.55)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glow-breathe": {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.06)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "page-in": {
          "0%": { opacity: "0", transform: "translateY(14px) scale(0.995)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "drop-in": {
          "0%": { opacity: "0", transform: "translateY(-6px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 240ms ease-out both",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        marquee: "marquee var(--marquee-duration, 40s) linear infinite",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "gradient-pan": "gradient-pan 8s ease infinite",
        rise: "rise 700ms cubic-bezier(0.22,1,0.36,1) both",
        "glow-breathe": "glow-breathe 7s ease-in-out infinite",
        blink: "blink 1.1s step-end infinite",
        "page-in": "page-in 500ms cubic-bezier(0.22,1,0.36,1) both",
        "drop-in": "drop-in 240ms cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
