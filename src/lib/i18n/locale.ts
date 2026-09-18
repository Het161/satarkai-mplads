/**
 * Locale constants, free of any server-only import.
 *
 * These live apart from ./index.ts because that module reaches for
 * `next/headers` to read the cookie, which makes the whole file server-only.
 * A client component that needs nothing more than the cookie's *name* — the
 * error boundary does — would drag `next/headers` into the client bundle and
 * fail the build. Splitting the constants out keeps both sides honest.
 */

export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "satarkai_locale";
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** The BCP 47 tag for `<html lang>` and for Intl formatting. */
export function htmlLang(locale: Locale): string {
  return locale === "hi" ? "hi-IN" : "en-IN";
}

/**
 * Fills `{name}` placeholders in a dictionary string.
 *
 * Interpolation has to happen inside the sentence rather than by concatenating
 * fragments around a value, because word order is not shared between the two
 * languages: "across 36 districts" puts the count before the noun, "36 ज़िलों
 * में" puts the postposition after it. Splitting the English into "across " +
 * n + " districts" bakes English grammar into the layout and leaves the Hindi
 * translator nothing to reorder.
 *
 * Unmatched placeholders are left as-is rather than blanked, so a missing
 * parameter shows up as a visible `{name}` in review instead of a sentence with
 * a hole in it.
 */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
