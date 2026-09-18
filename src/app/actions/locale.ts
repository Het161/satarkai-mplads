"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { LOCALE_COOKIE, isLocale } from "@/lib/i18n";

/**
 * Switch language.
 *
 * A one-year cookie rather than a user column: language is a preference of the
 * person at the screen, not of the account, and a shared district terminal is a
 * real thing. Nothing about it touches jurisdiction or permissions.
 */
export async function setLocale(formData: FormData): Promise<void> {
  const value = formData.get("locale")?.toString();
  if (!isLocale(value)) return;

  cookies().set(LOCALE_COOKIE, value, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}
