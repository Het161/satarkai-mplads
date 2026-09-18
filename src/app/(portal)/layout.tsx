import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/actions/auth";
import { SyntheticDataBanner } from "@/components/DataNotices";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { scopeFor } from "@/lib/scope";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { fill, t, type Dictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Resolve the plain-English name of the user's jurisdiction for the header. */
async function jurisdictionName(
  user: {
    role: string;
    stateId: string | null;
    districtId: string | null;
    mpId: string | null;
    iaId: string | null;
  },
  dict: Dictionary,
): Promise<string> {
  switch (user.role) {
    case "MINISTRY":
      return dict.scope.national;
    case "SNA": {
      const s = user.stateId
        ? await prisma.state.findUnique({ where: { id: user.stateId } })
        : null;
      return s
        ? fill(dict.jurisdiction.stateAll, { state: s.name })
        : dict.jurisdiction.noState;
    }
    case "DISTRICT": {
      const d = user.districtId
        ? await prisma.district.findUnique({
            where: { id: user.districtId },
            include: { state: true },
          })
        : null;
      return d
        ? fill(dict.jurisdiction.districtIn, {
            district: d.name,
            state: d.state.name,
          })
        : dict.jurisdiction.noDistrict;
    }
    case "MP": {
      const m = user.mpId
        ? await prisma.mP.findUnique({ where: { id: user.mpId } })
        : null;
      return m
        ? fill(dict.jurisdiction.constituency, {
            constituency: m.constituency,
            house: m.house === "RS" ? dict.dash.houseRS : dict.dash.houseLS,
          })
        : dict.jurisdiction.noConstituency;
    }
    case "IA": {
      const a = user.iaId
        ? await prisma.implementingAgency.findUnique({
            where: { id: user.iaId },
          })
        : null;
      return a ? a.name : dict.jurisdiction.noAgency;
    }
    default:
      return dict.scope.none;
  }
}

const NAV = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/alerts", key: "alerts" },
  { href: "/forecast", key: "forecast" },
  { href: "/works", key: "works" },
  { href: "/audit", key: "audit" },
] as const;

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const dict = t();
  const scope = scopeFor(user);
  const [jurisdiction, unread] = await Promise.all([
    jurisdictionName(user, dict),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <div className="min-h-screen">
      <SyntheticDataBanner />

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <Link
            href="/dashboard"
            className="text-base font-semibold tracking-tight text-ink"
          >
            Satark<span className="text-navy">AI</span>
          </Link>

          <nav aria-label={dict.nav.main} className="flex gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-2.5 py-1 text-2xs font-medium text-slate hover:bg-paper hover:text-ink"
              >
                {dict.nav[item.key]}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-3">
            <Link
              href="/notifications"
              className="relative rounded px-2.5 py-1 text-2xs font-medium text-slate hover:bg-paper hover:text-ink"
            >
              {dict.nav.notifications}
              {unread > 0 ? (
                <span className="tnum ml-1 rounded-full bg-severity-info px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
              <span className="sr-only">
                {unread > 0 ? `${unread} ${dict.common.unread}` : ""}
              </span>
            </Link>

            <div className="min-w-0 text-right">
              <div className="truncate text-2xs font-medium text-ink">
                {user.name}
              </div>
              <div className="truncate text-2xs text-slate">
                {dict.role[user.role]} · {jurisdiction}
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="whitespace-nowrap rounded border border-line px-2.5 py-1 text-2xs font-medium text-slate hover:bg-paper hover:text-ink"
              >
                {dict.nav.signOut}
              </button>
            </form>
            <LocaleSwitcher />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1400px] px-4 py-5">
        {scope.label === "none" ? (
          <div
            role="alert"
            className="rounded border border-severity-critical/30 bg-severity-critical/10 px-4 py-3 text-2xs text-severity-critical"
          >
            {dict.auth.noJurisdiction}
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
