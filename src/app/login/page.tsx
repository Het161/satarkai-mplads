import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

/**
 * Demo accounts are listed on the sign-in page on purpose: this is a synthetic
 * demonstration build and a reviewer must be able to see the platform from all
 * five MPLADS roles. A real deployment would remove this block outright.
 */
async function DemoAccounts() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: [
          "ministry@mospi.demo",
          "sna.gj@demo.gov",
          "district.gj-ahd@demo.gov",
          "mp.gj@demo.gov",
          "ia.gj-ahd@demo.gov",
        ],
      },
    },
    orderBy: { role: "asc" },
    select: { email: true, role: true, name: true },
  });

  if (users.length === 0) return null;

  const ROLE_ORDER = ["MINISTRY", "SNA", "DISTRICT", "MP", "IA"];
  const sorted = [...users].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
  );

  return (
    <div className="mt-6 rounded border border-line bg-paper px-4 py-3">
      <p className="text-2xs font-semibold uppercase tracking-wide text-slate">
        Demonstration accounts
      </p>
      <p className="mt-1 text-2xs text-slate">
        Each sees only its own jurisdiction. Password:{" "}
        <code className="rounded bg-white px-1 py-0.5 text-ink">
          satark@2026
        </code>
      </p>
      <ul className="mt-2 space-y-1">
        {sorted.map((u) => (
          <li key={u.email} className="flex justify-between gap-3 text-2xs">
            <span className="text-ink">{u.email}</span>
            <span className="shrink-0 text-slate">{u.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center px-4 py-10"
    >
      <div className="w-full max-w-sm">
        <header className="mb-6">
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              Satark<span className="text-navy">AI</span>
            </h1>
            <span className="text-2xs text-slate">सतर्क</span>
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-slate">
            MPLADS monitoring &amp; anomaly detection · Ministry of Statistics
            and Programme Implementation · Data Informatics &amp; Innovation
            Division
          </p>
        </header>

        <div className="rounded border border-line bg-white p-5 shadow-card">
          <LoginForm />
        </div>

        <DemoAccounts />

        <p className="mt-6 text-2xs leading-relaxed text-slate">
          Demonstration build on synthetic data. Signals produced here are
          prompts for human review, never findings of fraud.
        </p>
      </div>
    </main>
  );
}
