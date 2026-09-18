import type { Metadata, Viewport } from "next";

// Self-hosted: no network request at render time, so the app works offline.
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SatarkAI — MPLADS Oversight",
    template: "%s · SatarkAI",
  },
  description:
    "AI-assisted monitoring and anomaly detection for the Members of Parliament Local Area Development Scheme (MPLADS). Risk signals for human review — not automated verdicts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
