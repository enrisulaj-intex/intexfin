import { Prisma } from "@prisma/client";

type Numberish = number | string | Prisma.Decimal | null | undefined;

/**
 * Intl-i për "sq-AL" i ndan mijëshet me hapësirë (1 234 567,50), ndërsa
 * praktika kontabël dhe Excel-i në Shqipëri pritet me pikë (1.234.567,50).
 * Përdorim "de-DE", që jep saktësisht atë format.
 */
const NUMBER_LOCALE = "de-DE";
const DATE_LOCALE = "sq-AL";

export function toNumber(value: Numberish): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

/** Formatim monetar shqip: 1.250,00 Lekë */
export function formatMoney(value: Numberish, currency = "ALL"): string {
  const n = toNumber(value);
  const formatted = new Intl.NumberFormat(NUMBER_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  const suffix = currency === "ALL" ? "Lekë" : currency;
  return `${formatted} ${suffix}`;
}

export function formatNumber(value: Numberish): string {
  return new Intl.NumberFormat(NUMBER_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Formati për input[type=date] */
export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Për aprovim",
  APPROVED: "Aprovuar",
  REJECTED: "Refuzuar",
  PAID: "Paguar",
};

export const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 ring-slate-200",
  SUBMITTED: "bg-amber-50 text-amber-800 ring-amber-200",
  APPROVED: "bg-sky-50 text-sky-800 ring-sky-200",
  REJECTED: "bg-rose-50 text-rose-800 ring-rose-200",
  PAID: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

export const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Arkë / Cash",
  BANK: "Bankë",
  CARD: "Kartë",
  OTHER: "Tjetër",
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  FINANCE: "Financë",
  STAFF: "Staf",
};
