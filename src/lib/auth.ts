import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

import { env } from "./env";
import { prisma } from "./db";
import { scopeFor, type Scope, type ScopedUser } from "./scope";

export const SESSION_COOKIE = "satarkai_session";

const secretKey = new TextEncoder().encode(env.sessionSecret);

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  stateId: string | null;
  districtId: string | null;
  mpId: string | null;
  iaId: string | null;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Sign in. Returns null for both "no such user" and "wrong password" so the
 * caller cannot distinguish them — and still runs a bcrypt compare on a dummy
 * hash when the user is absent, so response time does not leak account
 * existence.
 */
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user || !user.active) {
    await bcrypt.compare(password, DUMMY_HASH);
    return null;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    stateId: user.stateId,
    districtId: user.districtId,
    mpId: user.mpId,
    iaId: user.iaId,
  };
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ uid: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${env.sessionMaxAge}s`)
    .sign(secretKey);

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: env.sessionMaxAge,
  });
}

export function destroySession(): void {
  cookies().delete(SESSION_COOKIE);
}

/**
 * Resolve the signed-in user. The cookie carries only the user id — role and
 * jurisdiction are re-read from the database on every request, so revoking a
 * user or moving them to another district takes effect immediately instead of
 * living on inside an already-issued token.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let uid: string;
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    if (typeof payload.uid !== "string") return null;
    uid = payload.uid;
  } catch {
    return null; // expired, tampered, or signed with an old secret
  }

  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user || !user.active) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    stateId: user.stateId,
    districtId: user.districtId,
    mpId: user.mpId,
    iaId: user.iaId,
  };
}

/** Session + its jurisdiction filter, the pair every page and route needs. */
export async function requireSession(): Promise<{
  user: SessionUser;
  scope: Scope;
}> {
  const user = await getSessionUser();
  if (!user) throw new UnauthenticatedError();
  return { user, scope: scopeFor(user as ScopedUser) };
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthenticatedError";
  }
}
