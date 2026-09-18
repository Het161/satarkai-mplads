import { Card, CardHeader } from "@/components/ui";
import type { AlertEvidence } from "@/lib/detectors/types";

/**
 * Renders the evidence behind an alert.
 *
 * This is the part that makes a signal reviewable rather than a verdict: the
 * rule in words, the figures it read, the underlying records with the breaching
 * row marked, and how the priority score was arrived at. An officer should be
 * able to disagree with the alert from this page alone.
 */

export function EvidencePanels({ evidence }: { evidence: AlertEvidence }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="The rule that fired" />
        <p className="px-4 py-3 text-sm leading-relaxed text-ink">
          {evidence.rule}
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Figures relied on"
          subtitle="Read directly from the work's record at the time of detection."
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
            title={evidence.rows.some((r) => r.flagged) ? "Records" : "What drove the score"}
            subtitle={
              evidence.rows.some((r) => r.flagged)
                ? "Rows marked in red are the ones that breach the rule."
                : "Each measure, this work's value against the typical one, and how much of the score it accounts for."
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">
                Underlying records this alert relied on
              </caption>
              <thead>
                <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                  <th scope="col" className="px-4 py-2 text-left font-medium">
                    Record
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
          title="How this was prioritised"
          subtitle="The score is a weighted sum, shown in full so it can be challenged."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <caption className="sr-only">
              Components of the anomaly-priority score
            </caption>
            <thead>
              <tr className="border-b border-line text-2xs uppercase tracking-wide text-slate">
                <th scope="col" className="px-4 py-2 text-left font-medium">Component</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Basis</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Weight</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Value</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {evidence.scoring.map((c) => (
                <tr key={c.label} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 text-ink">{c.label}</td>
                  <td className="px-4 py-2 text-slate">{c.basis}</td>
                  <td className="tnum px-4 py-2 text-right text-slate">
                    {Math.round(c.weight * 100)}%
                  </td>
                  <td className="tnum px-4 py-2 text-right text-slate">{c.value}</td>
                  <td className="tnum px-4 py-2 text-right text-ink">
                    {Math.round(c.weight * c.value)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line font-medium">
                <td className="px-4 py-2 text-ink" colSpan={4}>
                  Anomaly-Priority Score
                </td>
                <td className="tnum px-4 py-2 text-right text-ink">
                  {Math.round(
                    evidence.scoring.reduce((s, c) => s + c.weight * c.value, 0),
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
