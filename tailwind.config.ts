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
        /**
         * Dense, data-first — but readable first.
         *
         * The original scale was tuned for maximum rows on screen and bottomed
         * out at 11px, which is below what anyone should be asked to read a
         * financial figure at for a whole shift. The whole ramp is stepped up
         * here rather than patching individual components, so the hierarchy
         * the pages were designed around is preserved exactly and every
         * existing `text-*` class gets the benefit.
         *
         * `2xs` — the secondary-text workhorse — carries most of the gain:
         * 11px to 13px. Body text (`sm`) lands on 16px.
         */
        "2xs": ["0.8125rem", { lineHeight: "1.125rem" }],
        xs: ["0.9375rem", { lineHeight: "1.3125rem" }],
        sm: ["1rem", { lineHeight: "1.5rem" }],
        base: ["1.0625rem", { lineHeight: "1.625rem" }],
        lg: ["1.375rem", { lineHeight: "1.75rem" }],
        xl: ["1.625rem", { lineHeight: "2rem" }],
        "2xl": ["2rem", { lineHeight: "2.25rem" }],
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
