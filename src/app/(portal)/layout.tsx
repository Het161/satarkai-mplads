import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/actions/auth";
import { SyntheticDataBanner } from "@/components/DataNotices";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { scopeFor } from "@/lib/scope";
import { ROLE_LABELS } from "@/lib/scheme";

export const dynamic = "force-dynamic";

/** Resolve the plain-English name of the user's jurisdiction for the header. */
async function jurisdictionName(user: {
  role: string;
  stateId: string | null;
  districtId: string | null;
  mpId: string | null;
  iaId: string | null;
}): Promise<string> {
  switch (user.role) {
    case "MINISTRY":
      return "All States & Union Territories";
    case "SNA": {
      const s = user.stateId
        ? await prisma.state.findUnique({ where: { id: user.stateId } })
        : null;
      return s ? `${s.name} — all districts` : "No state assigned";
    }
    case "DISTRICT": {
      const d = user.districtId
        ? await prisma.district.findUnique({
            where: { id: user.districtId },
            include: { state: true },
          })
        : null;
      return d ? `${d.name} district, ${d.state.name}` : "No district assigned";
    }
    case "MP": {
      const m = user.mpId
        ? await prisma.mP.findUnique({ where: { id: user.mpId } })
        : null;
      return m ? `${m.constituency} · ${m.house}` : "No constituency assigned";
    }
    case "IA": {
      const a = user.iaId
        ? await prisma.implementingAgency.findUnique({ where: { id: user.iaId } })
        : null;
      return a ? a.name : "No agency assigned";
    }
    default:
      return "No jurisdiction assigned";
  }
}

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/works", label: "Works" },
];

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const scope = scopeFor(user);
  const jurisdiction = await jurisdictionName(user);

  return (
    <div className="min-h-screen">
      <SyntheticDataBanner />

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <Link href="/dashboard" className="text-base font-semibold tracking-tight text-ink">
            Satark<span className="text-navy">AI</span>
          </Link>

          <nav aria-label="Main" className="flex gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-2.5 py-1 text-2xs font-medium text-slate hover:bg-paper hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-3">
            <div className="min-w-0 text-right">
              <div className="truncate text-2xs font-medium text-ink">
                {user.name}
              </div>
              <div className="truncate text-2xs text-slate">
                {ROLE_LABELS[user.role]} · {jurisdiction}
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="whitespace-nowrap rounded border border-line px-2.5 py-1 text-2xs font-medium text-slate hover:bg-paper hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1400px] px-4 py-5">
        {scope.label === "No jurisdiction assigned" ? (
          <div
            role="alert"
            className="rounded border border-severity-critical/30 bg-severity-critical/10 px-4 py-3 text-2xs text-severity-critical"
          >
            This account has no jurisdiction assigned, so no scheme data can be
            shown. Contact the administrator to attach a state, district,
            constituency or agency to the account.
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
