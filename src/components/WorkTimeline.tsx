import Link from "next/link";
import clsx from "clsx";

import { Card, CardHeader, SeverityBadge } from "@/components/ui";
import { formatDate, formatINR, formatINRExact } from "@/lib/format";
import { ALERT_TYPE_LABELS, ALERT_TYPE_STEP } from "@/lib/scheme";

/**
 * A work's life, in order, with every risk signal attached to the step it
 * actually concerns.
 *
 * The point of the ordering is that an officer can see *where* a work went
 * wrong, not merely that it did. "Missing asset evidence" listed in a sidebar
 * is a label; the same signal sitting under the third payment stage, next to
 * the date that stage was released and the amount that left the treasury, is
 * something a person can act on.
 *
 * Steps that have not happened yet are shown as pending rather than omitted, so
 * the gap between "sanctioned and running" and "sanctioned and abandoned" is
 * visible.
 */

export type TimelineAlert = {
  id: string;
  type: keyof typeof ALERT_TYPE_LABELS;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  score: number;
  reason: string;
};

type Step = {
  key: string;
  /** Which ALERT_TYPE_STEP values land on this step. */
  stepNames: string[];
  title: string;
  actor: string;
  at: Date | null;
  /** Rendered under the heading when the step has happened. */
  detail?: React.ReactNode;
  /** Shown instead when it has not. */
  pending?: string;
};

export function WorkTimeline({
  work,
  alerts,
}: {
  work: {
    recommendedAt: Date;
    recommendedAmount: unknown;
    sanctionedAt: Date | null;
    sanctionedAmount: unknown;
    expectedCompletionAt: Date | null;
    completedAt: Date | null;
    markedCompleteAt: Date | null;
    progressPct: number;
    status: string;
    locality: string;
    mp: { name: string; constituency: string };
    district: { name: string; state: { name: string } };
    ia: { name: string } | null;
    payments: {
      id: string;
      stageNo: number;
      amount: unknown;
      releasedAt: Date;
      vendorName: string | null;
      voucherRef: string | null;
      evidence: { id: string; kind: string; uploadedAt: Date }[];
    }[];
  };
  alerts: TimelineAlert[];
}) {
  const totalEvidence = work.payments.reduce((s, p) => s + p.evidence.length, 0);
  const documentedStages = work.payments.filter((p) => p.evidence.length > 0).length;

  const steps: Step[] = [
    {
      key: "recommendation",
      stepNames: ["Recommendation & earmarking"],
      title: "Recommended and funds earmarked",
      actor: `${work.mp.name} · ${work.mp.constituency}`,
      at: work.recommendedAt,
      detail: (
        <>
          {formatINRExact(work.recommendedAmount as number)} earmarked against the
          Member&apos;s annual entitlement, for {work.locality}, {work.district.name}.
        </>
      ),
    },
    {
      key: "sanction",
      stepNames: ["Sanction"],
      title: "Sanctioned after feasibility checks",
      actor: `${work.district.name} District Authority`,
      at: work.sanctionedAt,
      detail: work.sanctionedAt ? (
        <>
          {formatINRExact(work.sanctionedAmount as number)} sanctioned. Due for
          completion by {formatDate(work.expectedCompletionAt)}, one year from
          sanction.
        </>
      ) : undefined,
      pending:
        work.status === "CANCELLED"
          ? "The recommendation was cancelled before sanction."
          : "Awaiting feasibility checks and sanction by the district authority.",
    },
    {
      key: "agency",
      stepNames: ["Designation of the implementing agency"],
      title: "Implementing agency designated",
      actor: work.ia?.name ?? "—",
      at: work.sanctionedAt,
      detail: work.ia ? <>Responsible for execution and for raising payment requests.</> : undefined,
      pending: "No agency designated yet.",
    },
  ];

  const paymentAlerts = alerts.filter(
    (a) => ALERT_TYPE_STEP[a.type] === "Vendor payments",
  );
  const evidenceAlerts = alerts.filter(
    (a) => ALERT_TYPE_STEP[a.type] === "Asset evidence",
  );

  return (
    <Card>
      <CardHeader
        title="The work, in order"
        subtitle="Recommendation through to completion marking, with every risk signal attached to the step it concerns."
      />

      <ol className="px-4 py-3">
        {steps.map((step) => (
          <TimelineStep
            key={step.key}
            step={step}
            alerts={alerts.filter((a) => step.stepNames.includes(ALERT_TYPE_STEP[a.type]))}
          />
        ))}

        {/* Payments and their evidence are interleaved rather than listed as two
            separate blocks, because the question an officer asks is "was this
            stage documented?", not "how many photographs exist in total". */}
        <li className="relative border-l border-line pb-5 pl-5 last:border-transparent">
          <Marker done={work.payments.length > 0} />
          <StepHeading
            title="Vendor payments and asset evidence"
            actor={work.ia?.name ?? "Implementing agency"}
            at={work.payments.length > 0 ? work.payments[0].releasedAt : null}
          />

          {work.payments.length === 0 ? (
            <p className="mt-1 text-2xs text-slate">
              No vendor payment has been released against this work yet.
            </p>
          ) : (
            <>
              <p className="mt-1 text-2xs text-slate">
                {work.payments.length} stage
                {work.payments.length === 1 ? "" : "s"} released,{" "}
                {documentedStages} with evidence on file ({totalEvidence} file
                {totalEvidence === 1 ? "" : "s"}).
              </p>

              <ol className="mt-2 space-y-2">
                {work.payments.map((p) => (
                  <li
                    key={p.id}
                    className={clsx(
                      "rounded border px-3 py-2",
                      p.evidence.length === 0
                        ? "border-severity-critical/30 bg-severity-critical/5"
                        : "border-line bg-paper",
                    )}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="text-sm font-medium text-ink">
                        Stage {p.stageNo}
                      </span>
                      <span className="tnum text-sm text-ink">
                        {formatINR(p.amount as number)}
                      </span>
                      <span className="tnum text-2xs text-slate">
                        released {formatDate(p.releasedAt)}
                      </span>
                      {p.vendorName ? (
                        <span className="text-2xs text-slate">to {p.vendorName}</span>
                      ) : null}
                      {p.voucherRef ? (
                        <span className="text-2xs text-slate">{p.voucherRef}</span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-2xs">
                      {p.evidence.length === 0 ? (
                        <span className="font-medium text-severity-critical">
                          No asset photograph or document on record for this stage
                        </span>
                      ) : (
                        <span className="text-slate">
                          {p.evidence
                            .map(
                              (e) =>
                                `${e.kind.toLowerCase()} uploaded ${formatDate(e.uploadedAt)}`,
                            )
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          <AlertList alerts={[...paymentAlerts, ...evidenceAlerts]} />
        </li>

        <TimelineStep
          step={{
            key: "completion-window",
            stepNames: ["Completion window"],
            title: "One-year completion window",
            actor: "Scheme guideline",
            at: work.expectedCompletionAt,
            detail: work.expectedCompletionAt ? (
              <>
                Sanctioned works are generally required to be completed within one
                year. Progress currently recorded at {work.progressPct}%.
              </>
            ) : undefined,
            pending: "Not applicable until the work is sanctioned.",
          }}
          alerts={alerts.filter((a) => ALERT_TYPE_STEP[a.type] === "Completion window")}
        />

        <TimelineStep
          step={{
            key: "complete",
            stepNames: [],
            title: "Complete on the ground",
            actor: work.ia?.name ?? "Implementing agency",
            at: work.completedAt,
            detail: work.completedAt ? <>Work physically finished.</> : undefined,
            pending: "Not yet reported as finished.",
          }}
          alerts={[]}
        />

        <TimelineStep
          last
          step={{
            key: "marked",
            stepNames: ["Completion marking", "Across the whole record"],
            title: "Marked complete by the implementing agency",
            actor: work.ia?.name ?? "Implementing agency",
            at: work.markedCompleteAt,
            detail: work.markedCompleteAt ? (
              <>
                The work now appears as completed. This final step is what makes a
                finished work visible as finished.
              </>
            ) : undefined,
            pending:
              "Not marked. Until the agency records completion, this work does not appear as completed anywhere — including on the public dashboard.",
          }}
          alerts={alerts.filter((a) =>
            ["Completion marking", "Across the whole record"].includes(
              ALERT_TYPE_STEP[a.type],
            ),
          )}
        />
      </ol>
    </Card>
  );
}

function TimelineStep({
  step,
  alerts,
  last = false,
}: {
  step: Step;
  alerts: TimelineAlert[];
  last?: boolean;
}) {
  const done = step.at !== null;
  return (
    <li
      className={clsx(
        "relative pb-5 pl-5",
        last ? "border-l border-transparent" : "border-l border-line",
      )}
    >
      <Marker done={done} />
      <StepHeading title={step.title} actor={step.actor} at={step.at} />
      <p className="mt-0.5 max-w-3xl text-2xs leading-relaxed text-slate">
        {done ? step.detail : step.pending}
      </p>
      <AlertList alerts={alerts} />
    </li>
  );
}

function Marker({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2",
        done ? "border-navy bg-navy" : "border-line bg-white",
      )}
    />
  );
}

function StepHeading({
  title,
  actor,
  at,
}: {
  title: string;
  actor: string;
  at: Date | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3">
      <h3 className={clsx("text-sm font-medium", at ? "text-ink" : "text-slate")}>
        {title}
      </h3>
      <span className="tnum text-2xs text-slate">
        {at ? formatDate(at) : "pending"}
      </span>
      <span className="text-2xs text-slate">{actor}</span>
    </div>
  );
}

function AlertList({ alerts }: { alerts: TimelineAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {alerts.map((a) => (
        <li key={a.id}>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={a.severity}>
              {a.severity.toLowerCase()}
            </SeverityBadge>
            <span className="tnum rounded border border-line bg-white px-1.5 py-0.5 text-2xs font-semibold text-ink">
              {a.score}
            </span>
            <Link
              href={`/alerts/${a.id}`}
              className="text-sm font-medium text-navy hover:underline"
            >
              {ALERT_TYPE_LABELS[a.type]}
            </Link>
          </div>
          <p className="mt-0.5 max-w-3xl text-2xs leading-relaxed text-slate">
            {a.reason}
          </p>
        </li>
      ))}
    </ul>
  );
}
