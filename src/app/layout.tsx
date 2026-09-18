import type { Metadata, Viewport } from "next";

import { getLocale, htmlLang, t } from "@/lib/i18n";

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
  // `lang` has to follow the chosen locale, not sit hard-coded at "en".
  // A screen reader announces Devanagari with an English voice otherwise,
  // which is unintelligible rather than merely wrong.
  const locale = getLocale();
  const dict = t();

  return (
    <html lang={htmlLang(locale)}>
      <body>
        <a href="#main" className="skip-link">
          {dict.nav.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
