import { cookies } from "next/headers";

import { en, type Dictionary } from "./en";
import { hi } from "./hi";

/**
 * Locale resolution.
 *
 * Cookie-based rather than routed (`/hi/...`), because every page here is
 * already dynamic and behind a session — there is nothing to cache per-locale
 * and no URLs to keep stable for search engines. A cookie keeps the language
 * with the officer across the whole platform, which is what someone working a
 * queue actually wants, and adds no routing surface to get RBAC wrong in.
 */

export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "satarkai_locale";
export const DEFAULT_LOCALE: Locale = "en";

const DICTIONARIES: Record<Locale, Dictionary> = { en, hi };

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The dictionary for this request. Server components call this directly. */
export function t(): Dictionary {
  return DICTIONARIES[getLocale()];
}

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** The BCP 47 tag for `<html lang>` and for Intl formatting. */
export function htmlLang(locale: Locale): string {
  return locale === "hi" ? "hi-IN" : "en-IN";
}

export type { Dictionary };
