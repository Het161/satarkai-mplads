import { Card, CardHeader } from "@/components/ui";
import type { AlertEvidence } from "@/lib/detectors/types";
import { t as tr } from "@/lib/i18n";

/**
 * Renders the evidence behind an alert.
 *
 * This is the part that makes a signal reviewable rather than a verdict: the
 * rule in words, the figures it read, the underlying records with the breaching
 * row marked, and how the priority score was arrived at. An officer should be
 * able to disagree with the alert from this page alone.
 */

export function EvidencePanels({ evidence }: { evidence: AlertEvidence }) {
  const d = tr();
  // The rule sentence, the fact labels, the record rows and the scoring basis
  // are all composed by the detectors and stored on the Alert row as finished
  // English. Marked so the i18n sweep in e2e/i18n.spec.ts can account for them
  // explicitly rather than by loosening its regex.
  return (
    <div className="space-y-4" data-detector-text>
      <Card>
        <CardHeader title={d.evidence.ruleTitle} />
        <p className="px-4 py-3 text-sm leading-relaxed text-ink">
          {evidence.rule}
        </p>
      </Card>

      <Card>
        <CardHeader
          title={d.evidence.factsTitle}
          subtitle={d.evidence.factsSubtitle}
        />
        <dl className="divide-y divide-line/60 text-sm">
          {evidence.facts.map((f) => (
            <div key={f.label} className="flex justify-between gap-4 px-4 py-2">
              <dt className="text-slate">{f.label}</dt>
              <dd className="tnum text-right text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {evidence.rows && evidence.rows.length > 0 ? (
        <Card>
          <CardHeader
            title={
              evidence.rows.some((r) => r.flagged)
                ? d.evidence.recordsTitle
                : d.evidence.driversTitle
            }
            subtitle={
              evidence.rows.some((r) => r.flagged)
                ? d.evidence.recordsSubtitle
                : d.evidence.driversSubtitle
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">{d.evidence.recordsCaption}</caption>
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    {d.evidence.recordColumn}
                  </th>
                  {evidence.rows[0].values.map((v) => (
                    <th
                      key={v.label}
                      scope="col"
                      className="px-4 py-2 text-left font-medium"
                    >
                      {v.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evidence.rows.map((row, i) => (
                  <tr
                    key={`${row.label}-${i}`}
                    className={
                      row.flagged
                        ? "border-b border-line/60 bg-severity-critical/5 last:border-0"
                        : "border-b border-line/60 last:border-0"
                    }
                  >
                    <th
                      scope="row"
                      className={
                        row.flagged
                          ? "px-4 py-2 text-left font-medium text-severity-critical"
                          : "px-4 py-2 text-left font-medium text-ink"
                      }
                    >
                      {row.label}
                    </th>
                    {row.values.map((v) => (
                      <td key={v.label} className="tnum px-4 py-2 text-slate">
                        {v.value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={d.evidence.scoringTitle}
          subtitle={d.evidence.scoringSubtitle}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">{d.evidence.scoringCaption}</caption>
            <thead>
              <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  {d.evidence.component}
                </th>
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  {d.evidence.basis}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {d.evidence.weight}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {d.evidence.value}
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  {d.evidence.contribution}
                </th>
              </tr>
            </thead>
            <tbody>
              {evidence.scoring.map((c) => (
                <tr
                  key={c.label}
                  className="border-b border-line/60 last:border-0"
                >
                  <td className="px-4 py-2 text-ink">{c.label}</td>
                  <td className="px-4 py-2 text-slate">{c.basis}</td>
                  <td className="tnum px-4 py-2 text-right text-slate">
                    {Math.round(c.weight * 100)}%
                  </td>
                  <td className="tnum px-4 py-2 text-right text-slate">
                    {c.value}
                  </td>
                  <td className="tnum px-4 py-2 text-right text-ink">
                    {Math.round(c.weight * c.value)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-medium">
                <td className="px-4 py-2 text-ink" colSpan={4}>
                  {d.evidence.total}
                </td>
                <td className="tnum px-4 py-2 text-right text-ink">
                  {Math.round(
                    evidence.scoring.reduce(
                      (s, c) => s + c.weight * c.value,
                      0,
                    ),
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
