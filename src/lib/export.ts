/**
 * CSV generation.
 *
 * Small and deliberate rather than a dependency: the correctness that matters
 * in a government export is escaping and encoding, and both are a few lines.
 */

/** RFC 4180 quoting. Anything else corrupts a file the moment a note contains a comma. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: unknown[][]): string {
  const lines = [columns.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))];
  // A BOM, so Excel opens the file as UTF-8 rather than mangling every rupee
  // sign and every Indian place name with a diacritic. Without it the export
  // looks broken to the one audience most likely to open it in Excel.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

/**
 * Rupee amounts for a PDF.
 *
 * pdfkit's built-in fonts are WinAnsi-encoded and have no ₹ (U+20B9), so the
 * glyph would silently come out as garbage. "Rs." is what Indian government
 * documents used before the sign existed and is still widely used in print, so
 * it is the honest substitution rather than embedding a font to avoid saying so.
 */
export function pdfMoney(value: unknown): string {
  const n = value === null || value === undefined ? 0 : Number(String(value));
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `Rs. ${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `Rs. ${(n / 1_00_000).toFixed(2)} L`;
  return `Rs. ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Strip characters the built-in PDF fonts cannot represent. */
export function pdfText(s: string): string {
  return s.replace(/₹/g, "Rs. ").replace(/[—–]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}
