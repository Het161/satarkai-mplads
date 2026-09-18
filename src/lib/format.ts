import type { Prisma } from "@prisma/client";

type Money = Prisma.Decimal | number | string | null | undefined;

function toNumber(value: Money): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

/**
 * Indian rupee figures in the lakh/crore convention officials actually read.
 * MPLADS works run from a few lakh to a few crore, so plain ₹12,50,00,000 is
 * harder to scan than ₹12.50 Cr.
 */
export function formatINR(value: Money): string {
  const n = toNumber(value);
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Exact rupees, for tables and exports where rounding would mislead. */
export function formatINRExact(value: Money): string {
  return `₹${toNumber(value).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  })}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

export function formatPct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export function money(value: Money): number {
  return toNumber(value);
}
