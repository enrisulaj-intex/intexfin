"use server";

import { revalidatePath } from "next/cache";
import {
  Prisma,
  type Account,
  type Currency,
  type TransactionType,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { canSeeAll, requireUser, type CurrentUser } from "@/lib/session";
import {
  CURRENCY_LABELS,
  TYPE_LABELS,
  TYPE_PREFIX,
  computeEffects,
  usesCategory,
  usesSupplier,
  usesTwoAccounts,
} from "@/lib/transactions";
import { cashBoxName } from "@/lib/accounts";
import { computeTotals } from "@/lib/validation";
import { toNumber } from "@/lib/format";
import {
  FIELD_LABELS,
  MAX_IMPORT_ROWS,
  REQUIRED_FIELDS,
  type RawRow,
  matchField,
  normalizeHeader,
  parseAccountKindCell,
  parseAmountCell,
  parseBooleanCell,
  parseCurrencyCell,
  parseDateCell,
  parseDirectionCell,
  parseImportFile,
} from "@/lib/import-parse";

/** Rreshti i normalizuar, gati për t'u shkruar. */
type NormalizedRow = {
  date: Date;
  description: string;
  currency: Currency;
  amount: number;
  vatRate: number;
  categoryName: string | null;
  supplierId: string | null;
  documentNumber: string | null;
  counterparty: string | null;
  ownerId: string;
  ownerName: string;
  accountKind: "ARKE" | "BANKE";
  bankAccountId: string | null;
  toAccountId: string | null;
  toAccountName: string | null;
  surplus: boolean;
  affectsBalance: boolean;
  notes: string | null;
};

export type PreviewRow = {
  line: number;
  errors: string[];
  warnings: string[];
  /** Vlerat e shfaqura në tabelën e kontrollit. */
  display: {
    data: string;
    pershkrimi: string;
    monedha: string;
    shuma: string;
    punonjesi: string;
    llogaria: string;
  };
};

export type ImportPreview = {
  type: TransactionType;
  fileName: string;
  rows: PreviewRow[];
  validCount: number;
  errorCount: number;
  warningCount: number;
  unknownHeaders: string[];
  /** Rreshtat e papërpunuar që u pranuan, për t'u dërguar sërish në konfirmim. */
  payload: string;
};

export type ImportState = {
  error?: string;
  success?: string;
  preview?: ImportPreview;
};

/** Konteksti i kërkuar për të zgjidhur emrat në identifikues. */
type Lookups = {
  users: User[];
  accounts: Account[];
  suppliers: { id: string; name: string }[];
};

async function loadLookups(): Promise<Lookups> {
  const [users, accounts, suppliers] = await Promise.all([
    prisma.user.findMany({ where: { active: true } }),
    prisma.account.findMany(),
    prisma.supplier.findMany({ select: { id: true, name: true } }),
  ]);
  return { users, accounts, suppliers };
}

function findUser(lookups: Lookups, raw: string): User | null {
  const key = normalizeHeader(raw);
  if (!key) return null;
  return (
    lookups.users.find((u) => normalizeHeader(u.email) === key) ??
    lookups.users.find((u) => normalizeHeader(u.name) === key) ??
    // Ndihmë për "Arjan" kur në sistem është "Arjan Hoxha"
    lookups.users.find((u) => normalizeHeader(u.name).startsWith(`${key} `)) ??
    null
  );
}

function findAccountByName(lookups: Lookups, raw: string): Account | null {
  const key = normalizeHeader(raw);
  if (!key) return null;
  return (
    lookups.accounts.find((a) => normalizeHeader(a.name) === key) ??
    lookups.accounts.find((a) => normalizeHeader(a.name).includes(key)) ??
    null
  );
}

/**
 * Kthen një rresht të papërpunuar në vlera të gatshme, ose në listë gabimesh.
 * Përdoret njësoj te shikimi paraprak dhe te konfirmimi, që të mos ketë
 * dy rrugë validimi që mund të ndahen nga njëra-tjetra.
 */
function normalizeRow(
  row: RawRow,
  type: TransactionType,
  user: CurrentUser,
  lookups: Lookups,
): { ok: true; value: NormalizedRow } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const cell = (key: string) => (row.cells[key] ?? "").trim();

  for (const field of REQUIRED_FIELDS[type]) {
    if (!cell(field)) errors.push(`${FIELD_LABELS[field]} mungon`);
  }

  const date = parseDateCell(cell("data"));
  if (cell("data") && !date) errors.push("Data nuk lexohet (përdor 25.09.2026 ose 2026-09-25)");

  const currency = parseCurrencyCell(cell("monedha"));
  if (cell("monedha") && !currency) errors.push("Monedha duhet Lek, EUR ose USD");

  const amount = parseAmountCell(cell("shuma"));
  if (cell("shuma") && !Number.isFinite(amount)) errors.push("Shuma nuk lexohet");
  else if (Number.isFinite(amount) && amount <= 0) errors.push("Shuma duhet më e madhe se 0");

  const vatRaw = cell("tvsh");
  let vatRate = 0;
  if (vatRaw) {
    vatRate = parseAmountCell(vatRaw.replace("%", ""));
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      errors.push("TVSH duhet numër midis 0 dhe 100");
      vatRate = 0;
    }
  }

  // Punonjësi: bosh do të thotë vetja.
  let owner: { id: string; name: string } = { id: user.id, name: user.name };
  const ownerRaw = cell("punonjesi");
  if (ownerRaw) {
    const found = findUser(lookups, ownerRaw);
    if (!found) errors.push(`Punonjësi "${ownerRaw}" nuk u gjet`);
    else if (found.id !== user.id && !canSeeAll(user.role)) {
      errors.push("Nuk ke të drejtë të hedhësh në arkën e këtij punonjësi");
    } else owner = { id: found.id, name: found.name };
  }

  // Burimi: arkë (parazgjedhje) ose bankë.
  let accountKind: "ARKE" | "BANKE" = "ARKE";
  let bankAccountId: string | null = null;
  const accountRaw = cell("llogaria");
  if (accountRaw && type !== "DEPOZITIM" && type !== "E_DREJTE") {
    const kind = parseAccountKindCell(accountRaw);
    if (kind) {
      accountKind = kind;
    } else {
      const bank = findAccountByName(lookups, accountRaw);
      if (!bank) errors.push(`Llogaria "${accountRaw}" nuk u gjet`);
      else if (bank.kind !== "BANKE") {
        errors.push(`"${accountRaw}" nuk është llogari bankare`);
      } else {
        accountKind = "BANKE";
        bankAccountId = bank.id;
      }
    }
  }
  if (accountKind === "BANKE" && !bankAccountId && currency) {
    // "Bankë" pa emër: pranohet vetëm nëse ka një llogari të vetme në atë monedhë.
    const candidates = lookups.accounts.filter(
      (a) => a.kind === "BANKE" && a.active && a.currency === currency,
    );
    if (candidates.length === 1) bankAccountId = candidates[0].id;
    else if (candidates.length === 0) {
      errors.push(`Nuk ka llogari bankare në ${currency}`);
    } else {
      errors.push("Shkruaj emrin e llogarisë bankare — ka disa në këtë monedhë");
    }
  }

  // Destinacioni për depozitim dhe transfertë.
  let toAccountId: string | null = null;
  let toAccountName: string | null = null;
  if (usesTwoAccounts(type)) {
    const destRaw = cell("teLlogaria");
    const dest = destRaw ? findAccountByName(lookups, destRaw) : null;
    if (destRaw && !dest) errors.push(`Llogaria "${destRaw}" nuk u gjet`);
    if (dest) {
      if (currency && dest.currency !== currency) {
        errors.push("Destinacioni është në monedhë tjetër — këmbimi nuk mbështetet");
      }
      if (
        !canSeeAll(user.role) &&
        dest.kind === "ARKE" &&
        dest.ownerId !== user.id
      ) {
        errors.push("Mund të dërgosh para vetëm në bankë ose në arkat e tua");
      }
      toAccountId = dest.id;
      toAccountName = dest.name;
    }
  }

  let surplus = false;
  if (type === "DIFERENCE") {
    const direction = parseDirectionCell(cell("drejtimi"));
    if (direction === null) errors.push("Drejtimi duhet 'Tepricë' ose 'Mungesë'");
    else surplus = direction;
  }

  let supplierId: string | null = null;
  const supplierRaw = cell("furnitori");
  if (supplierRaw && usesSupplier(type)) {
    const key = normalizeHeader(supplierRaw);
    const supplier = lookups.suppliers.find((s) => normalizeHeader(s.name) === key);
    if (!supplier) errors.push(`Furnitori "${supplierRaw}" nuk u gjet`);
    else supplierId = supplier.id;
  }

  const description = cell("pershkrimi");
  if (description && description.length > 500) errors.push("Përshkrimi është shumë i gjatë");

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      date: date as Date,
      description,
      currency: currency as Currency,
      amount,
      vatRate,
      categoryName: usesCategory(type) ? cell("kategoria") || null : null,
      supplierId,
      documentNumber: cell("dokumenti") || null,
      counterparty: cell("pala") || null,
      ownerId: owner.id,
      ownerName: owner.name,
      accountKind,
      bankAccountId,
      toAccountId,
      toAccountName,
      surplus,
      affectsBalance: type === "SHPENZIM" ? !parseBooleanCell(cell("vetemPash")) : true,
      notes: cell("shenime") || null,
    },
  };
}

function parseType(raw: unknown): TransactionType | null {
  const types: TransactionType[] = [
    "SHPENZIM", "ARKETIM", "DEPOZITIM", "E_DREJTE", "DIFERENCE", "TRANSFERTE",
  ];
  return types.find((t) => t === raw) ?? null;
}

/** Hapi 1: lexon skedarin dhe tregon çfarë do të shkruhej. Nuk ruan asgjë. */
export async function previewImportAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireUser();
  const type = parseType(formData.get("type"));
  if (!type) return { error: "Lloji i lëvizjes nuk u njoh." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Zgjidh një skedar .xlsx ose .csv." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: "Skedari e kalon kufirin e 10 MB." };
  }

  let parsed;
  try {
    parsed = await parseImportFile(file);
  } catch (error) {
    return { error: (error as Error).message };
  }

  if (parsed.rows.length === 0) {
    return { error: "Skedari nuk ka rreshta me të dhëna." };
  }
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    return {
      error: `Skedari ka ${parsed.rows.length} rreshta — ndaje në pjesë deri në ${MAX_IMPORT_ROWS}.`,
    };
  }

  const lookups = await loadLookups();

  const normalized = parsed.rows.map((row) => ({
    row,
    result: normalizeRow(row, type, user, lookups),
  }));

  // Kërkimi i dyfishimeve: marrim lëvizjet ekzistuese brenda intervalit të skedarit
  // dhe i krahasojmë në memorie, në vend të një query-je për çdo rresht.
  const validDates = normalized
    .filter((n) => n.result.ok)
    .map((n) => (n.result as { value: NormalizedRow }).value.date.getTime());
  let existingKeys = new Set<string>();
  if (validDates.length > 0) {
    const existing = await prisma.transaction.findMany({
      where: {
        type,
        date: {
          gte: new Date(Math.min(...validDates) - 86400000),
          lte: new Date(Math.max(...validDates) + 86400000),
        },
      },
      select: { date: true, totalAmount: true, description: true, currency: true },
    });
    existingKeys = new Set(
      existing.map(
        (e) =>
          // toFixed(2) në të dy anët — Decimal-i e jep "17400", jo "17400.00",
          // dhe pa këtë çelësat nuk përputhen kurrë.
          `${e.date.toISOString().slice(0, 10)}|${toNumber(e.totalAmount).toFixed(
            2,
          )}|${e.currency}|${normalizeHeader(e.description)}`,
      ),
    );
  }

  const accepted: RawRow[] = [];
  const rows: PreviewRow[] = normalized.map(({ row, result }) => {
    if (!result.ok) {
      return {
        line: row.line,
        errors: result.errors,
        warnings: [],
        display: {
          data: row.cells.data ?? "",
          pershkrimi: row.cells.pershkrimi ?? "",
          monedha: row.cells.monedha ?? "",
          shuma: row.cells.shuma ?? "",
          punonjesi: row.cells.punonjesi ?? "",
          llogaria: row.cells.llogaria ?? row.cells.teLlogaria ?? "",
        },
      };
    }

    const value = result.value;
    const totals = computeTotals(value.amount, value.vatRate);
    const key = `${value.date.toISOString().slice(0, 10)}|${totals.totalAmount.toFixed(
      2,
    )}|${value.currency}|${normalizeHeader(value.description)}`;

    const warnings: string[] = [];
    if (existingKeys.has(key)) {
      warnings.push("Ekziston një lëvizje e njëjtë — mund të jetë dyfishim");
    }

    accepted.push(row);
    return {
      line: row.line,
      errors: [],
      warnings,
      display: {
        data: value.date.toISOString().slice(0, 10),
        pershkrimi: value.description,
        monedha: CURRENCY_LABELS[value.currency],
        shuma: totals.totalAmount.toFixed(2),
        punonjesi: value.ownerName,
        llogaria:
          value.toAccountName ??
          (value.accountKind === "BANKE" ? "Bankë" : "Arkë"),
      },
    };
  });

  // Kolonat që sistemi nuk i njeh — tregohen si paralajmërim, nuk bllokojnë.
  const unknownHeaders = parsed.headers.filter(
    (h) => h.trim() !== "" && !matchField(h),
  );

  return {
    preview: {
      type,
      fileName: file.name,
      rows,
      validCount: accepted.length,
      errorCount: rows.filter((r) => r.errors.length > 0).length,
      warningCount: rows.filter((r) => r.warnings.length > 0).length,
      unknownHeaders,
      payload: JSON.stringify(accepted),
    },
  };
}

/** Hapi 2: shkruan rreshtat e konfirmuar. Validimi bëhet sërish nga fillimi. */
export async function confirmImportAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireUser();
  const type = parseType(formData.get("type"));
  if (!type) return { error: "Lloji i lëvizjes nuk u njoh." };

  let raw: RawRow[];
  try {
    raw = JSON.parse(String(formData.get("payload") ?? "[]"));
  } catch {
    return { error: "Të dhënat e ngarkimit nuk u lexuan. Provo ta ngarkosh sërish skedarin." };
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Nuk ka rreshta për t'u ngarkuar." };
  }
  if (raw.length > MAX_IMPORT_ROWS) {
    return { error: "Shumë rreshta për një ngarkim të vetëm." };
  }

  const lookups = await loadLookups();
  const values: NormalizedRow[] = [];
  for (const row of raw) {
    const result = normalizeRow(row, type, user, lookups);
    if (!result.ok) {
      return {
        error: `Rreshti ${row.line}: ${result.errors.join(", ")}. Asgjë nuk u shkrua.`,
      };
    }
    values.push(result.value);
  }

  const year = new Date().getFullYear();
  const prefix = `${TYPE_PREFIX[type]}-${year}-`;

  try {
    await prisma.$transaction(
      async (tx) => {
        const last = await tx.transaction.findFirst({
          where: { reference: { startsWith: prefix } },
          orderBy: { reference: "desc" },
          select: { reference: true },
        });
        let counter = last ? Number(last.reference.slice(prefix.length)) : 0;
        if (!Number.isFinite(counter)) counter = 0;

        // Arkat e prekura krijohen një herë, jo për çdo rresht.
        const cashBoxCache = new Map<string, string>();
        const categoryCache = new Map<string, string>();

        for (const value of values) {
          let accountId: string | null = null;
          if (type !== "E_DREJTE") {
            if (type === "DEPOZITIM" || value.accountKind === "ARKE") {
              const cacheKey = `${value.ownerId}|${value.currency}`;
              let boxId = cashBoxCache.get(cacheKey);
              if (!boxId) {
                const box = await tx.account.upsert({
                  where: {
                    ownerId_kind_currency: {
                      ownerId: value.ownerId,
                      kind: "ARKE",
                      currency: value.currency,
                    },
                  },
                  update: {},
                  create: {
                    kind: "ARKE",
                    currency: value.currency,
                    name: cashBoxName(value.currency),
                    ownerId: value.ownerId,
                  },
                });
                boxId = box.id;
                cashBoxCache.set(cacheKey, boxId);
              }
              accountId = boxId;
            } else {
              accountId = value.bankAccountId;
            }
          }

          let categoryId: string | null = null;
          if (value.categoryName) {
            const key = normalizeHeader(value.categoryName);
            categoryId = categoryCache.get(key) ?? null;
            if (!categoryId) {
              const existing = await tx.category.findFirst({
                where: { name: { equals: value.categoryName, mode: "insensitive" } },
              });
              if (existing) categoryId = existing.id;
              else {
                const code =
                  value.categoryName
                    .toUpperCase()
                    .normalize("NFD")
                    .replace(/[̀-ͯ]/g, "")
                    .replace(/[^A-Z0-9]+/g, "_")
                    .replace(/^_+|_+$/g, "")
                    .slice(0, 20) || "KATEGORI";
                const taken = await tx.category.findUnique({ where: { code } });
                const created = await tx.category.create({
                  data: {
                    name: value.categoryName,
                    code: taken
                      ? `${code.slice(0, 15)}_${Math.floor(Math.random() * 9999)}`
                      : code,
                  },
                });
                categoryId = created.id;
              }
              categoryCache.set(key, categoryId);
            }
          }

          const totals = computeTotals(value.amount, value.vatRate);
          const effects = computeEffects({
            type,
            total: totals.totalAmount,
            affectsBalance: value.affectsBalance,
            surplus: value.surplus,
          });

          counter += 1;
          const record = await tx.transaction.create({
            data: {
              reference: `${prefix}${String(counter).padStart(4, "0")}`,
              type,
              source: "IMPORT",
              date: value.date,
              description: value.description,
              documentNumber: value.documentNumber,
              counterparty: value.counterparty,
              currency: value.currency,
              amount: new Prisma.Decimal(totals.amount),
              vatRate: new Prisma.Decimal(value.vatRate),
              vatAmount: new Prisma.Decimal(totals.vatAmount),
              totalAmount: new Prisma.Decimal(totals.totalAmount),
              accountId,
              toAccountId: value.toAccountId,
              accountEffect: new Prisma.Decimal(effects.accountEffect),
              toAccountEffect: new Prisma.Decimal(effects.toAccountEffect),
              affectsBalance: value.affectsBalance,
              categoryId,
              supplierId: value.supplierId,
              notes: value.notes,
              createdById: user.id,
            },
          });

          await tx.auditLog.create({
            data: {
              action: "TRANSACTION_IMPORTED",
              details: `Ngarkim nga skedar — ${record.reference}`,
              userId: user.id,
              transactionId: record.id,
            },
          });
        }
      },
      { timeout: 120_000 },
    );
  } catch (error) {
    return { error: `Ngarkimi dështoi: ${(error as Error).message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath("/levizjet");
  revalidatePath("/arka");
  revalidatePath("/ngarkim");

  return {
    success: `U ngarkuan ${values.length} ${
      values.length === 1 ? "lëvizje" : "lëvizje"
    } të llojit "${TYPE_LABELS[type]}".`,
  };
}
