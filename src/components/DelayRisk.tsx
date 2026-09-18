import clsx from "clsx";

import { Card, CardHeader } from "@/components/ui";

/**
 * Delay-risk forecasts are presented deliberately differently from alerts.
 *
 * An alert says something has gone wrong and carries the records that show it.
 * A forecast says something may go wrong, on a model's reading of works that
 * came before. The second deserves a quieter treatment — no severity colour, no
 * review queue, no case to open — because acting on a forecast as if it were a
 * finding is how a monitoring system starts accusing people of things that have
 * not happened.
 */

export type DriverRow = {
  feature: string;
  label: string;
  value: number;
  peer_median: number;
  contribution: number;
};

const BAND_STYLES: Record<string, string> = {
  VERY_HIGH: "border-severity-critical/30 bg-severity-critical/5 text-severity-critical",
  HIGH: "border-severity-high/30 bg-severity-high/5 text-severity-high",
  MODERATE: "border-line bg-paper text-slate",
  LOW: "border-line bg-paper text-slate",
};

const BAND_LABELS: Record<string, string> = {
  VERY_HIGH: "Very likely to overrun",
  HIGH: "Likely to overrun",
  MODERATE: "Some risk of overrun",
  LOW: "On track",
};

export function DelayRiskBadge({ band }: { band: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-2xs font-medium",
        BAND_STYLES[band] ?? BAND_STYLES.LOW,
      )}
    >
      {BAND_LABELS[band] ?? band}
    </span>
  );
}

export function DelayRiskPanel({
  probability,
  band,
  drivers,
  modelVersion,
  computedAt,
}: {
  probability: number;
  band: string;
  drivers: DriverRow[];
  modelVersion: string;
  computedAt: string;
}) {
  return (
    <Card>
      <CardHeader
        title="Delay-risk forecast"
        subtitle="A prediction about what may happen, not a finding about what has. Nothing here is an alert and no case is opened."
        action={<DelayRiskBadge band={band} />}
      />

      <div className="px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="tnum text-2xl font-semibold leading-none text-ink">
            {Math.round(probability * 100)}%
          </span>
          <span className="text-2xs text-slate">
            estimated chance of passing one year from sanction without being
            marked complete
          </span>
        </div>
      </div>

      {drivers.length > 0 ? (
        <>
          <div className="border-t border-line px-4 py-2 text-2xs font-medium uppercase tracking-wide text-slate">
            What the estimate rests on
          </div>
          <table className="w-full text-sm">
            <caption className="sr-only">
              Features driving the delay-risk estimate for this work
            </caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Factor</th>
                <th scope="col">This work</th>
                <th scope="col">Typical</th>
                <th scope="col">Effect</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.feature} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="px-4 py-2 text-left font-normal text-ink">
                    {d.label}
                  </th>
                  <td className="tnum px-4 py-2 text-right text-slate">
                    {formatDelayValue(d)}
                  </td>
                  <td className="tnum px-4 py-2 text-right text-slate">
                    typical {formatDelayValue({ ...d, value: d.peer_median })}
                  </td>
                  <td className="tnum px-4 py-2 text-right text-slate">
                    +{d.contribution.toFixed(1)} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="border-t border-line px-4 py-3 text-2xs text-slate">
          Nothing about this work stands out from the works the model learned
          from, so no single factor explains the estimate.
        </p>
      )}

      <p className="border-t border-line px-4 py-2 text-2xs leading-relaxed text-slate">
        {modelVersion} · computed {computedAt}. Each factor&apos;s effect is
        measured by asking what the estimate would have been had this work been
        ordinary on that one point. Because factors interact, they do not sum to
        the total.
      </p>
    </Card>
  );
}

function formatDelayValue(d: { feature: string; value: number }): string {
  switch (d.feature) {
    case "agencyPriorLateRate":
    case "districtPriorLateRate":
    case "workTypePriorLateRate":
      return `${Math.round(d.value * 100)}% late`;
    case "agencyPriorCount":
      return `${Math.round(d.value * 20)} works`;
    case "sanctionLagRatio":
      return `${Math.round(d.value * 180)} days`;
    case "fyEndProximity":
      return d.value > 0 ? `${Math.round((1 - d.value) * 90)} days before close` : "—";
    case "sanctionMonth":
      return [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ][Math.max(0, Math.min(11, Math.round(d.value * 12) - 1))];
    case "amountScale":
      return `₹${Math.round(
        Math.pow(10, d.value * Math.log10(50_000_000)),
      ).toLocaleString("en-IN")}`;
    case "unitCount":
      return `${Math.round(d.value)}`;
    case "sanctionToRecommendRatio":
      return `${d.value.toFixed(2)}x`;
    default:
      return d.value.toFixed(2);
  }
}
