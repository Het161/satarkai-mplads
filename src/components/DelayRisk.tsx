import clsx from "clsx";

import { Card, CardHeader } from "@/components/ui";
import { fill, getLocale, htmlLang, t as tr } from "@/lib/i18n";

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

/** Same computed steps as the severity badges — see SEVERITY_STYLES in ui.tsx. */
const BAND_STYLES: Record<string, string> = {
  VERY_HIGH:
    "border-severity-critical/30 bg-severity-critical/5 text-severity-critical",
  HIGH: "border-severity-high/30 bg-severity-high/5 text-[#9A4A04]",
  MODERATE: "border-line bg-paper text-slate",
  LOW: "border-line bg-paper text-slate",
};

/** The four bands the model emits, as the officer's language rather than the
    enum's. An unrecognised band falls through to its raw value rather than to
    "On track", so a model change shows up instead of reading as reassurance. */
function bandLabel(band: string, d: ReturnType<typeof tr>): string {
  switch (band) {
    case "VERY_HIGH":
      return d.delay.VERY_HIGH;
    case "HIGH":
      return d.delay.HIGH;
    case "MODERATE":
      return d.delay.MODERATE;
    case "LOW":
      return d.delay.LOW;
    default:
      return band;
  }
}

export function DelayRiskBadge({ band }: { band: string }) {
  const d = tr();
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-2xs font-medium",
        BAND_STYLES[band] ?? BAND_STYLES.LOW,
      )}
    >
      {bandLabel(band, d)}
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
  const d = tr();
  return (
    <Card>
      <CardHeader
        title={d.delay.panelTitle}
        subtitle={d.delay.panelSubtitle}
        action={<DelayRiskBadge band={band} />}
      />

      <div className="px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="tnum text-2xl font-semibold leading-none text-ink">
            {Math.round(probability * 100)}%
          </span>
          <span className="text-2xs text-slate">{d.delay.chanceOf}</span>
        </div>
      </div>

      {drivers.length > 0 ? (
        <>
          <div className="border-t border-line px-4 py-2 text-2xs font-medium uppercase tracking-wide text-slate">
            {d.delay.restsOn}
          </div>
          <table className="w-full text-sm">
            <caption className="sr-only">{d.delay.driversCaption}</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">{d.delay.factor}</th>
                <th scope="col">{d.delay.thisWork}</th>
                <th scope="col">{d.delay.typical}</th>
                <th scope="col">{d.delay.effect}</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((row) => (
                <tr
                  key={row.feature}
                  className="border-b border-line/60 last:border-0"
                >
                  <th
                    scope="row"
                    className="px-4 py-2 text-left font-normal text-ink"
                  >
                    {row.label}
                  </th>
                  <td className="tnum px-4 py-2 text-right text-slate">
                    {formatDelayValue(row, d)}
                  </td>
                  <td className="tnum px-4 py-2 text-right text-slate">
                    {fill(d.delay.typicalValue, {
                      value: formatDelayValue(
                        { ...row, value: row.peer_median },
                        d,
                      ),
                    })}
                  </td>
                  <td className="tnum px-4 py-2 text-right text-slate">
                    {fill(d.delay.points, {
                      points: row.contribution.toFixed(1),
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="border-t border-line px-4 py-3 text-2xs text-slate">
          {d.delay.nothingStandsOut}
        </p>
      )}

      <p className="border-t border-line px-4 py-2 text-2xs leading-relaxed text-slate">
        {fill(d.delay.ablationNote, {
          model: modelVersion,
          date: computedAt,
        })}
      </p>
    </Card>
  );
}

function formatDelayValue(
  row: { feature: string; value: number },
  d: ReturnType<typeof tr>,
): string {
  switch (row.feature) {
    case "agencyPriorLateRate":
    case "districtPriorLateRate":
    case "workTypePriorLateRate":
      return fill(d.delay.lateShare, { pct: Math.round(row.value * 100) });
    case "agencyPriorCount":
      return fill(d.delay.worksCount, { count: Math.round(row.value * 20) });
    case "sanctionLagRatio":
      return fill(d.delay.daysCount, { count: Math.round(row.value * 180) });
    case "fyEndProximity":
      return row.value > 0
        ? fill(d.delay.daysBeforeClose, {
            count: Math.round((1 - row.value) * 90),
          })
        : "—";
    case "sanctionMonth":
      // Month names come from Intl rather than the dictionary: the locale
      // already knows them, and a hand-written list would be one more thing
      // to keep in step with the calendar the rest of the app formats with.
      return new Intl.DateTimeFormat(htmlLang(getLocale()), {
        month: "short",
        timeZone: "UTC",
      }).format(
        new Date(
          Date.UTC(
            2024,
            Math.max(0, Math.min(11, Math.round(row.value * 12) - 1)),
            1,
          ),
        ),
      );
    case "amountScale":
      return `₹${Math.round(
        Math.pow(10, row.value * Math.log10(50_000_000)),
      ).toLocaleString("en-IN")}`;
    case "unitCount":
      return `${Math.round(row.value)}`;
    case "sanctionToRecommendRatio":
      return `${row.value.toFixed(2)}x`;
    default:
      return row.value.toFixed(2);
  }
}
