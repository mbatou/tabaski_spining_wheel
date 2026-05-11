import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "blue-ciel": "#1DC8FF",
        "wave-violet": "#4749D5",
        butter: "#FFE89A",
        ink: "#0A0A0A",
      },
      fontFamily: {
        display: ["var(--font-urbanist)", "system-ui", "sans-serif"],
        mono: ["var(--font-roboto-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
