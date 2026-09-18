import type { Config } from "tailwindcss";

/**
 * "Audit" design system — government-serious, data-first.
 * Severity colours are reserved for risk. Never use them decoratively.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1220",
        navy: "#12356B",
        slate: "#45536B",
        line: "#DCE3EC",
        paper: "#F6F8FB",
        white: "#FFFFFF",
        severity: {
          critical: "#B3261E",
          high: "#D97706",
          medium: "#C2A11A",
          low: "#1E7F4F",
          info: "#2E5F9E",
        },
      },
      fontFamily: {
        sans: ["'Inter Variable'", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Dense, data-first scale.
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11, 18, 32, 0.06), 0 0 0 1px rgba(11, 18, 32, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
