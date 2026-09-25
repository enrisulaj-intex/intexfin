import { Prisma, type Currency } from "@prisma/client";

type Numberish = number | string | Prisma.Decimal | null | undefined;

/**
 * Intl-i për "sq-AL" i ndan mijëshet me hapësirë (1 234 567,50), ndërsa
 * praktika kontabël dhe Excel-i në Shqipëri pritet me pikë (1.234.567,50).
 * Përdorim "de-DE", që jep saktësisht atë format.
 */
const NUMBER_LOCALE = "de-DE";
const DATE_LOCALE = "sq-AL";

const SYMBOLS: Record<string, string> = { ALL: "L", EUR: "€", USD: "$" };

export function toNumber(value: Numberish): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

export function formatNumber(value: Numberish): string {
  return new Intl.NumberFormat(NUMBER_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

/** Formatim monetar: 1.250,00 L — 1.250,00 € — 1.250,00 $ */
export function formatMoney(value: Numberish, currency: Currency | string = "ALL"): string {
  return `${formatNumber(value)} ${SYMBOLS[currency] ?? currency}`;
}

/** Si formatMoney, por me shenjën + para vlerave pozitive. Zeroja mbetet pa shenjë. */
export function formatSigned(value: Numberish, currency: Currency | string = "ALL"): string {
  const n = toNumber(value);
  if (n === 0) return formatMoney(0, currency);
  return `${n > 0 ? "+" : ""}${formatMoney(n, currency)}`;
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

export function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Formati për input[type=date] — në orën lokale, jo UTC. */
export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  FINANCE: "Financë",
  STAFF: "Staf",
};

export const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Hedhur me dorë",
  INTEX: "Intex Courier",
  IMPORT: "Ngarkim Excel",
};

export const MONTHS_SQ = [
  "Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor",
  "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor",
];
