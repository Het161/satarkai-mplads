import { cookies } from "next/headers";

import { en, type Dictionary } from "./en";
import { hi } from "./hi";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locale";

/**
 * Locale resolution.
 *
 * Cookie-based rather than routed (`/hi/...`), because every page here is
 * already dynamic and behind a session — there is nothing to cache per-locale
 * and no URLs to keep stable for search engines. A cookie keeps the language
 * with the officer across the whole platform, which is what someone working a
 * queue actually wants, and adds no routing surface to get RBAC wrong in.
 *
 * This module reads `next/headers`, so it is server-only. Anything a client
 * component needs — the cookie name, `fill`, `htmlLang` — lives in ./locale.ts
 * and is re-exported here so call sites have one import either way.
 */

export {
  DEFAULT_LOCALE,
  fill,
  htmlLang,
  isLocale,
  LOCALE_COOKIE,
  LOCALES,
  type Locale,
} from "./locale";

const DICTIONARIES: Record<Locale, Dictionary> = { en, hi };

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

export type { Dictionary };
