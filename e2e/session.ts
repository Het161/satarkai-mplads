import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

/**
 * Mint a session cookie for a seeded account.
 *
 * Signing the cookie directly rather than driving the sign-in form: these tests
 * are about the review workflow and accessibility, and re-typing a password on
 * every test would make them slower and no more truthful. The sign-in form
 * itself is covered by its own test.
 */
export const prisma = new PrismaClient();

export async function cookieFor(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const key = new TextEncoder().encode(process.env.SESSION_SECRET!);
  const token = await new SignJWT({ uid: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  return {
    name: "satarkai_session",
    value: token,
    domain: "127.0.0.1",
    path: "/",
  };
}

export function localeCookie(locale: "en" | "hi") {
  return {
    name: "satarkai_locale",
    value: locale,
    domain: "127.0.0.1",
    path: "/",
  };
}
