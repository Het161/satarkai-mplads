import { fill, t as tr } from "@/lib/i18n";

/**
 * Data provenance label — lives apart from the other primitives in ui.tsx.
 *
 * It is the only one of them that reads the locale cookie, which makes it
 * server-only. ui.tsx is imported by ReviewPanel, a client component, so
 * keeping this here is what lets that file stay usable from both sides.
 *
 * Every figure in this platform carries its source and date; a government
 * dashboard that cannot say where a number came from is not fit for decisions.
 */
export function ProvenanceNote({
  kind,
  name,
  fetchedAt,
  note,
}: {
  kind: "REAL" | "SYNTHETIC";
  name: string;
  fetchedAt: string;
  note?: string;
}) {
  const d = tr();
  return (
    <p className="text-2xs leading-relaxed text-slate">
      <span className="font-medium text-ink">{d.common.source}</span> {name} ·{" "}
      {kind === "SYNTHETIC" ? d.common.syntheticData : d.common.officialRecord}{" "}
      · {fill(d.common.asOf, { date: fetchedAt })}
      {note ? <> · {note}</> : null}
    </p>
  );
}
