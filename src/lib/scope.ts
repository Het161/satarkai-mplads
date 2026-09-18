import type { Prisma, Role } from "@prisma/client";

/**
 * Jurisdiction scoping — the single source of truth for RBAC.
 *
 * RBAC here is a *server-side query filter*, not a UI concern. Every query that
 * touches scheme data spreads the matching fragment into its `where`:
 *
 *     const scope = scopeFor(user);
 *     prisma.work.findMany({ where: { ...scope.work, status: "IN_PROGRESS" } });
 *
 * The fragments are built so that the failure mode is *deny*, never *allow*:
 * a user whose jurisdiction anchor is missing gets DENY_ALL, which matches no
 * rows. Dropping a scope spread is still a bug, but a user with a broken
 * jurisdiction can never see another jurisdiction's works.
 */

export type ScopedUser = {
  role: Role;
  stateId: string | null;
  districtId: string | null;
  mpId: string | null;
  iaId: string | null;
};

/** An id that cannot exist — cuid() never produces it. Matches zero rows. */
const IMPOSSIBLE_ID = "__no_jurisdiction__";

const DENY_ALL = { id: IMPOSSIBLE_ID } as const;

export type Scope = {
  role: Role;
  /** Human-readable description of what this user can see, for the UI header. */
  label: string;
  work: Prisma.WorkWhereInput;
  alert: Prisma.AlertWhereInput;
  district: Prisma.DistrictWhereInput;
  state: Prisma.StateWhereInput;
  mp: Prisma.MPWhereInput;
  agency: Prisma.ImplementingAgencyWhereInput;
  payment: Prisma.PaymentWhereInput;
};

export function scopeFor(user: ScopedUser): Scope {
  switch (user.role) {
    // Central Nodal Agency (MoSPI) — the whole country.
    case "MINISTRY":
      return {
        role: user.role,
        label: "All States & UTs",
        work: {},
        alert: {},
        district: {},
        state: {},
        mp: {},
        agency: {},
        payment: {},
      };

    // State Nodal Authority — every district in one state.
    case "SNA": {
      if (!user.stateId) return denyAll(user.role);
      const stateId = user.stateId;
      return {
        role: user.role,
        label: "State jurisdiction",
        work: { district: { stateId } },
        alert: { work: { district: { stateId } } },
        district: { stateId },
        state: { id: stateId },
        mp: { stateId },
        agency: { district: { stateId } },
        payment: { work: { district: { stateId } } },
      };
    }

    // District Authority (NDA/IDA) — one district's works.
    case "DISTRICT": {
      if (!user.districtId) return denyAll(user.role);
      const districtId = user.districtId;
      return {
        role: user.role,
        label: "District jurisdiction",
        work: { districtId },
        alert: { work: { districtId } },
        district: { id: districtId },
        state: { districts: { some: { id: districtId } } },
        mp: { works: { some: { districtId } } },
        agency: { districtId },
        payment: { work: { districtId } },
      };
    }

    // Hon'ble MP — only the works they themselves recommended.
    case "MP": {
      if (!user.mpId) return denyAll(user.role);
      const mpId = user.mpId;
      return {
        role: user.role,
        label: "Own constituency works",
        work: { mpId },
        alert: { work: { mpId } },
        district: { works: { some: { mpId } } },
        state: { mps: { some: { id: mpId } } },
        mp: { id: mpId },
        agency: { works: { some: { mpId } } },
        payment: { work: { mpId } },
      };
    }

    // Implementing Agency — only works assigned to them.
    case "IA": {
      if (!user.iaId) return denyAll(user.role);
      const iaId = user.iaId;
      return {
        role: user.role,
        label: "Assigned works",
        work: { iaId },
        alert: { work: { iaId } },
        district: { agencies: { some: { id: iaId } } },
        state: { districts: { some: { agencies: { some: { id: iaId } } } } },
        mp: { works: { some: { iaId } } },
        agency: { id: iaId },
        payment: { work: { iaId } },
      };
    }

    default:
      return denyAll(user.role);
  }
}

function denyAll(role: Role): Scope {
  return {
    role,
    label: "No jurisdiction assigned",
    work: DENY_ALL,
    alert: DENY_ALL,
    district: DENY_ALL,
    state: DENY_ALL,
    mp: DENY_ALL,
    agency: DENY_ALL,
    payment: DENY_ALL,
  };
}

/**
 * Combine a scope fragment with query-specific filters.
 *
 * Prefer this over spreading. Spreading looks equivalent:
 *
 *     { ...scope.work, districtId: someId }   // WRONG
 *
 * but if the caller's filter uses a key the scope also uses — `districtId` for
 * a District user, `mpId` for an MP — the later key wins and the jurisdiction
 * filter is silently gone. `scoped()` puts both under AND, so the scope can
 * only ever narrow the result, never be overwritten by it.
 */
export function scoped<T extends object>(fragment: T, ...filters: T[]): T {
  return { AND: [fragment, ...filters] } as unknown as T;
}

/**
 * Roles that may act on an alert (acknowledge / seek clarification / explain /
 * escalate). MPs and IAs read their data; they do not close oversight alerts.
 */
export function canActOnAlerts(role: Role): boolean {
  return role === "MINISTRY" || role === "SNA" || role === "DISTRICT";
}
