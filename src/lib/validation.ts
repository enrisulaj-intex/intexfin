import { z } from "zod";

/** Pranon "1250.50", "1250,50" dhe "1.250,50" */
function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return NaN;
  let s = raw.trim().replace(/\s/g, "");
  if (s === "") return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // "1.250,50" -> pika është ndarës mijësh
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  return Number(s);
}

const amountSchema = z
  .preprocess(parseAmount, z.number({ invalid_type_error: "Vlerë e pavlefshme" }))
  .refine((n) => Number.isFinite(n), { message: "Vlerë e pavlefshme" });

const currencySchema = z.enum(["ALL", "EUR", "USD"]);
const typeSchema = z.enum([
  "SHPENZIM",
  "ARKETIM",
  "DEPOZITIM",
  "E_DREJTE",
  "DIFERENCE",
  "TRANSFERTE",
]);

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email-i është i detyrueshëm")
    .email("Email i pavlefshëm")
    .toLowerCase(),
  password: z.string().min(1, "Fjalëkalimi është i detyrueshëm"),
});

/**
 * Lëvizja e parasë. Fushat e llogarive janë opsionale në skemë sepse
 * varen nga lloji; kontrolli i tyre bëhet te `resolveAccounts` në action.
 */
export const transactionSchema = z.object({
  type: typeSchema,
  date: z
    .string()
    .min(1, "Data është e detyrueshme")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Datë e pavlefshme"),
  description: z
    .string()
    .trim()
    .min(2, "Përshkrimi duhet të ketë të paktën 2 karaktere")
    .max(500, "Përshkrimi është shumë i gjatë"),
  currency: currencySchema,
  amount: amountSchema.refine((n) => n > 0, "Vlera duhet të jetë më e madhe se 0"),
  vatRate: amountSchema
    .refine((n) => n >= 0 && n <= 100, "TVSH duhet të jetë midis 0 dhe 100")
    .default(0),
  /** Punonjësi, arka e të cilit preket. Bosh = vetja. */
  ownerId: z.string().optional().nullable(),
  /** ARKE ose BANKE — nga cila lloj llogarie lëviz paraja. */
  accountKind: z.enum(["ARKE", "BANKE"]).default("ARKE"),
  /** Llogaria bankare e zgjedhur, kur accountKind = BANKE. */
  bankAccountId: z.string().optional().nullable(),
  /** Destinacioni për transfertë. */
  toAccountId: z.string().optional().nullable(),
  categoryName: z.string().trim().max(120).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  documentNumber: z.string().trim().max(60).optional().nullable(),
  counterparty: z.string().trim().max(160).optional().nullable(),
  /** Vetëm për DIFERENCE: "PLUS" = tepricë, "MINUS" = mungesë. */
  direction: z.enum(["PLUS", "MINUS"]).default("MINUS"),
  /** Arkëtimi mbyll këtë të drejtë për arkëtim. */
  settlesId: z.string().optional().nullable(),
  affectsBalance: z.coerce.boolean().default(true),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const accountSchema = z.object({
  id: z.string().optional().nullable(),
  kind: z.enum(["ARKE", "BANKE"]),
  name: z.string().trim().min(2, "Emri është i detyrueshëm").max(120),
  currency: currencySchema,
  ownerId: z.string().optional().nullable(),
  openingBalance: amountSchema.default(0),
  active: z.coerce.boolean().default(true),
});

export const categorySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Kodi duhet të ketë të paktën 2 karaktere")
    .max(20, "Kodi është shumë i gjatë")
    .regex(/^[A-Za-z0-9._-]+$/, "Kodi lejon vetëm shkronja, numra, . _ -")
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2, "Emri është i detyrueshëm").max(120),
  description: z.string().trim().max(300).optional().nullable(),
  active: z.coerce.boolean().default(true),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Emri është i detyrueshëm").max(160),
  nipt: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .transform((v) => (v ? v.toUpperCase() : null)),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .nullable()
    .refine((v) => !v || z.string().email().safeParse(v).success, "Email i pavlefshëm"),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(240).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  active: z.coerce.boolean().default(true),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(2, "Emri është i detyrueshëm").max(120),
  email: z.string().trim().toLowerCase().email("Email i pavlefshëm"),
  role: z.enum(["ADMIN", "FINANCE", "STAFF"]),
  password: z
    .string()
    .min(8, "Fjalëkalimi duhet të ketë të paktën 8 karaktere")
    .max(100),
});

export const userUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Emri është i detyrueshëm").max(120),
  role: z.enum(["ADMIN", "FINANCE", "STAFF"]),
  active: z.coerce.boolean(),
  password: z
    .string()
    .max(100)
    .optional()
    .refine((v) => !v || v.length >= 8, "Fjalëkalimi duhet të ketë të paktën 8 karaktere"),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

/** Llogarit TVSH-në dhe totalin me rrumbullakim në 2 dhjetore. */
export function computeTotals(amount: number, vatRate: number) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const net = round2(amount);
  const vatAmount = round2((net * vatRate) / 100);
  return { amount: net, vatAmount, totalAmount: round2(net + vatAmount) };
}

/** Mbledh gabimet e Zod-it në një hartë fushë → mesazh. */
export function collectFieldErrors(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}
