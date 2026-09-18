import PDFDocument from "pdfkit";

import { requireSession, UnauthenticatedError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { AlertEvidence } from "@/lib/detectors/types";
import { pdfMoney, pdfText } from "@/lib/export";
import { scoped } from "@/lib/scope";
import { ALERT_TYPE_LABELS, WORK_STATUS_LABELS } from "@/lib/scheme";
import { ALERT_STATE_LABELS } from "@/lib/review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * One alert as a PDF case note.
 *
 * Written to be filed and read on paper, which shapes the content: the whole
 * reason, the whole evidence table, the whole review trail, and — twice — the
 * statement that this is a risk signal rather than a finding. A page that
 * leaves an office without that line on it is exactly the page that gets
 * misread as an accusation.
 *
 * Scope-filtered like every other read. An alert outside the officer's
 * jurisdiction is not found, so it cannot be exported around the boundary.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return new Response("Not signed in", { status: 401 });
    }
    throw error;
  }

  const { user, scope } = session;

  const alert = await prisma.alert.findFirst({
    where: scoped(scope.alert, { id: params.id }),
    include: {
      work: {
        include: { district: { include: { state: true } }, mp: true, ia: true },
      },
      actions: { orderBy: { at: "asc" }, include: { byUser: true } },
    },
  });

  if (!alert) return new Response("Not found", { status: 404 });

  const evidence = alert.evidenceJson as unknown as AlertEvidence;
  const w = alert.work;

  const doc = new PDFDocument({
    size: "A4",
    margin: 48,
    info: {
      Title: `SatarkAI alert ${w.workCode}`,
      Author: "SatarkAI — MPLADS monitoring (demonstration build)",
      Subject: ALERT_TYPE_LABELS[alert.type],
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const INK = "#0B1220";
  const SLATE = "#45536B";
  const LINE = "#DCE3EC";
  const width = doc.page.width - 96;

  const rule = () => {
    doc.moveDown(0.4);
    doc
      .strokeColor(LINE)
      .lineWidth(0.5)
      .moveTo(48, doc.y)
      .lineTo(doc.page.width - 48, doc.y)
      .stroke();
    doc.moveDown(0.5);
  };

  const heading = (text: string) => {
    doc.moveDown(0.6);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(pdfText(text));
    doc.moveDown(0.25);
  };

  const field = (label: string, value: string) => {
    doc.font("Helvetica").fontSize(9).fillColor(SLATE).text(pdfText(label), { continued: true });
    doc.fillColor(INK).text(pdfText(`  ${value}`), { align: "right" });
  };

  // -- banner: the first thing on the page, before any figure --------------
  const bannerText =
    "SYNTHETIC DEMONSTRATION DATA - every figure, work, Member of Parliament, agency and vendor below is generated for demonstration. No official MPLADS record is reproduced.";
  doc.font("Helvetica-Bold").fontSize(7.5);
  const bannerTop = doc.y;
  const bannerHeight =
    doc.heightOfString(bannerText, { width: width - 16 }) + 12;

  doc.rect(48, bannerTop, width, bannerHeight).fillColor("#FDF3E7").fill();
  doc
    .fillColor("#7A4A06")
    .text(bannerText, 56, bannerTop + 6, { width: width - 16 });
  doc.y = bannerTop + bannerHeight + 10;
  doc.x = 48;

  doc.fillColor(INK).font("Helvetica-Bold").fontSize(15).text("SatarkAI");
  doc
    .fillColor(SLATE)
    .font("Helvetica")
    .fontSize(8)
    .text("MPLADS monitoring - alert case note");
  rule();

  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text(pdfText(ALERT_TYPE_LABELS[alert.type]));
  doc
    .fillColor(SLATE)
    .font("Helvetica")
    .fontSize(9)
    .text(
      pdfText(
        `Anomaly-Priority Score ${alert.score} of 100 - ${alert.severity.toLowerCase()} - ${ALERT_STATE_LABELS[alert.state]}`,
      ),
    );
  doc.moveDown(0.5);
  doc.fillColor(INK).fontSize(10).text(pdfText(alert.reason), { width });

  doc.moveDown(0.6);
  doc
    .fillColor("#2E5F9E")
    .font("Helvetica-Oblique")
    .fontSize(8.5)
    .text(
      pdfText(
        "This is a risk signal raised for human review. It is not a finding of fraud, irregularity or wrongdoing by any person or organisation.",
      ),
      { width },
    );

  heading("The work");
  field("Title", w.title);
  field("Work code", w.workCode);
  field("Location", `${w.locality}, ${w.district.name}, ${w.district.state.name}`);
  field("Recommended by", `${w.mp.name} (${w.mp.constituency})`);
  field("Implementing agency", w.ia?.name ?? "Not designated");
  field("Stage", WORK_STATUS_LABELS[w.status]);
  field("Financial year", w.financialYear);
  field("Recommended amount", pdfMoney(w.recommendedAmount));
  field("Sanctioned amount", w.sanctionedAmount ? pdfMoney(w.sanctionedAmount) : "-");
  field("Recorded progress", `${w.progressPct}%`);

  heading("The rule that fired");
  doc.font("Helvetica").fontSize(9).fillColor(INK).text(pdfText(evidence.rule), { width });

  heading("Figures relied on");
  for (const f of evidence.facts) field(f.label, f.value);

  if (evidence.rows?.length) {
    heading("Records");
    for (const row of evidence.rows.slice(0, 20)) {
      doc
        .font(row.flagged ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9)
        .fillColor(row.flagged ? "#B3261E" : INK)
        .text(pdfText(row.label));
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(SLATE)
        .text(pdfText(row.values.map((v) => `${v.label}: ${v.value}`).join("  -  ")), {
          width,
          indent: 10,
        });
      doc.moveDown(0.2);
    }
    if (evidence.rows.length > 20) {
      doc
        .fontSize(8)
        .fillColor(SLATE)
        .text(pdfText(`... and ${evidence.rows.length - 20} further records.`));
    }
  }

  heading("How this was prioritised");
  for (const c of evidence.scoring) {
    field(
      `${c.label} (${Math.round(c.weight * 100)}% weight)`,
      `${c.value}/100 -> contributes ${Math.round(c.weight * c.value)} points`,
    );
    doc.font("Helvetica").fontSize(8).fillColor(SLATE).text(pdfText(c.basis), { indent: 10 });
  }

  doc.moveDown(0.2);
  field("Anomaly-Priority Score", `${alert.score} of 100`);

  heading("Review trail");
  if (alert.actions.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(SLATE)
      .text("No action recorded. This alert is awaiting review.");
  } else {
    for (const a of alert.actions) {
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(INK)
        .text(
          pdfText(
            `${ALERT_STATE_LABELS[a.toState]} - ${a.byUser.name} - ${a.at.toISOString().slice(0, 16).replace("T", " ")} UTC`,
          ),
        );
      if (a.note) {
        doc
          .font("Helvetica")
          .fontSize(8.5)
          .fillColor(SLATE)
          .text(pdfText(a.note), { width: width - 10, indent: 10 });
      }
      doc.moveDown(0.25);
    }
  }

  rule();
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(SLATE)
    .text(
      pdfText(
        `Exported by ${user.name} on ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC. ` +
          "Amounts are shown as Rs. because the rupee sign is not available in this document's font. " +
          "AI flags, a human decides: every signal here is a prompt for review, and no penalty, report or " +
          "adverse inference follows from it automatically.",
      ),
      { width },
    );

  doc.end();
  const buffer = await finished;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="satarkai-alert-${w.workCode.replace(/[^A-Za-z0-9]+/g, "-")}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
