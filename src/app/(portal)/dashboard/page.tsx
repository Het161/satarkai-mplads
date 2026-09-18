import type { Metadata } from "next";

import { ProvenanceNote } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { latestSource } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";

import { AgencyDashboard } from "./AgencyDashboard";
import { DistrictDashboard } from "./DistrictDashboard";
import { MinistryDashboard } from "./MinistryDashboard";
import { MpDashboard } from "./MpDashboard";
import { StateDashboard } from "./StateDashboard";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * One route, five dashboards.
 *
 * Each role gets a page built around the decision that role actually makes —
 * the Ministry triages states, an SNA chases districts, a district officer
 * chases agencies, an MP asks what their entitlement bought, an agency sees
 * what it still owes. Showing all five the same grid with different numbers
 * would be easier to build and worse to use.
 *
 * What does *not* vary is the data access. Every one of them reads the same
 * scope-filtered query functions; the scope is built server-side from the
 * session. There is no national mode, no "show everything" switch — a Ministry
 * user simply has a scope that matches everything.
 */
export default async function DashboardPage() {
  const { user, scope } = await requireSession();
  const source = await latestSource();

  const dashboard = await renderFor(user, scope);

  return (
    <div className="space-y-5">
      {dashboard}
      {source ? (
        <ProvenanceNote
          kind={source.kind}
          name={source.name}
          fetchedAt={formatDate(source.fetchedAt)}
          note={source.sourceUrl ? `modelled on ${source.sourceUrl}` : undefined}
        />
      ) : null}
    </div>
  );
}

async function renderFor(
  user: Awaited<ReturnType<typeof requireSession>>["user"],
  scope: Awaited<ReturnType<typeof requireSession>>["scope"],
) {
  switch (user.role) {
    case "MINISTRY":
      return <MinistryDashboard scope={scope} />;

    case "SNA": {
      const state = user.stateId
        ? await prisma.state.findUnique({ where: { id: user.stateId } })
        : null;
      return (
        <StateDashboard scope={scope} stateName={state?.name ?? "Your state"} />
      );
    }

    case "DISTRICT": {
      const district = user.districtId
        ? await prisma.district.findUnique({
            where: { id: user.districtId },
            include: { state: true },
          })
        : null;
      return (
        <DistrictDashboard
          scope={scope}
          districtName={district?.name ?? "Your district"}
          stateName={district?.state.name ?? ""}
        />
      );
    }

    case "MP": {
      const mp = user.mpId
        ? await prisma.mP.findUnique({ where: { id: user.mpId } })
        : null;
      if (!mp) return <MinistryDashboard scope={scope} />;
      return <MpDashboard scope={scope} mp={mp} />;
    }

    case "IA": {
      const agency = user.iaId
        ? await prisma.implementingAgency.findUnique({ where: { id: user.iaId } })
        : null;
      return (
        <AgencyDashboard
          scope={scope}
          agencyName={agency?.name ?? "Your agency"}
        />
      );
    }

    default:
      // scopeFor() has already denied this user everything; the layout shows
      // the explanation. Rendering the national view is safe because its
      // queries carry the same empty scope.
      return <MinistryDashboard scope={scope} />;
  }
}
