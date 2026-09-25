import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "@/lib/session";
import { visibleTransactionWhere } from "@/lib/scope";

export type TransactionFilters = {
  kerko?: string;
  lloji?: string;
  monedha?: string;
  kategori?: string;
  punonjesi?: string;
  nga?: string;
  deri?: string;
  faqe?: string;
};

const TYPES = [
  "SHPENZIM",
  "ARKETIM",
  "DEPOZITIM",
  "E_DREJTE",
  "DIFERENCE",
  "TRANSFERTE",
];
const CURRENCIES = ["ALL", "EUR", "USD"];

export function buildTransactionWhere(
  filters: TransactionFilters,
  user: CurrentUser,
): Prisma.TransactionWhereInput {
  const conditions: Prisma.TransactionWhereInput[] = [
    visibleTransactionWhere(user),
  ];

  if (filters.lloji && TYPES.includes(filters.lloji)) {
    conditions.push({ type: filters.lloji as Prisma.TransactionWhereInput["type"] });
  }
  if (filters.monedha && CURRENCIES.includes(filters.monedha)) {
    conditions.push({
      currency: filters.monedha as Prisma.TransactionWhereInput["currency"],
    });
  }
  if (filters.kategori) conditions.push({ categoryId: filters.kategori });
  if (filters.punonjesi) {
    conditions.push({
      OR: [
        { account: { ownerId: filters.punonjesi } },
        { toAccount: { ownerId: filters.punonjesi } },
        { createdById: filters.punonjesi },
      ],
    });
  }

  const from =
    filters.nga && !Number.isNaN(Date.parse(filters.nga))
      ? new Date(filters.nga)
      : undefined;
  const to =
    filters.deri && !Number.isNaN(Date.parse(filters.deri))
      ? new Date(filters.deri)
      : undefined;
  if (from || to) {
    conditions.push({
      date: {
        ...(from ? { gte: from } : {}),
        // përfshi gjithë ditën e fundit
        ...(to ? { lte: new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) } : {}),
      },
    });
  }

  const term = filters.kerko?.trim();
  if (term) {
    conditions.push({
      OR: [
        { reference: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { documentNumber: { contains: term, mode: "insensitive" } },
        { counterparty: { contains: term, mode: "insensitive" } },
        { supplier: { name: { contains: term, mode: "insensitive" } } },
      ],
    });
  }

  return { AND: conditions };
}

export const PAGE_SIZE = 25;

export function parsePage(raw?: string): number {
  const n = Number(raw ?? "1");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function buildQueryString(
  filters: TransactionFilters,
  overrides: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...overrides })) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
