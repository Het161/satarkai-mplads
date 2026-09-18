/**
 * Mint a session cookie for a seeded demo account, for smoke-testing pages
 * with curl without driving the sign-in form. Dev/demo only.
 *
 * Usage: npx tsx -r dotenv/config scripts/demo-cookie.ts <email> dotenv_config_path=.env
 */
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("usage: demo-cookie.ts <email>");

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const key = new TextEncoder().encode(process.env.SESSION_SECRET!);
  const token = await new SignJWT({ uid: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${process.env.SESSION_MAX_AGE ?? 28800}s`)
    .sign(key);

  process.stdout.write(token);
}

main().finally(() => prisma.$disconnect());
