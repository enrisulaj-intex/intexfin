import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "@/lib/session";
import { canSeeAllExpenses } from "@/lib/session";

export type ExpenseFilters = {
  kerko?: string;
  status?: string;
  kategori?: string;
  furnitor?: string;
  nga?: string;
  deri?: string;
  faqe?: string;
};

const STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID"];

export function buildExpenseWhere(
  filters: ExpenseFilters,
  user: CurrentUser,
): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {};

  if (!canSeeAllExpenses(user.role)) {
    where.createdById = user.id;
  }

  if (filters.status && STATUSES.includes(filters.status)) {
    where.status = filters.status as Prisma.EnumExpenseStatusFilter["equals"];
  }
  if (filters.kategori) where.categoryId = filters.kategori;
  if (filters.furnitor) where.supplierId = filters.furnitor;

  const from = filters.nga && !Number.isNaN(Date.parse(filters.nga))
    ? new Date(filters.nga)
    : undefined;
  const to = filters.deri && !Number.isNaN(Date.parse(filters.deri))
    ? new Date(filters.deri)
    : undefined;
  if (from || to) {
    where.expenseDate = {
      ...(from ? { gte: from } : {}),
      // përfshi gjithë ditën e fundit
      ...(to ? { lte: new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) } : {}),
    };
  }

  const term = filters.kerko?.trim();
  if (term) {
    where.OR = [
      { reference: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { documentNumber: { contains: term, mode: "insensitive" } },
      { supplier: { name: { contains: term, mode: "insensitive" } } },
    ];
  }

  return where;
}

export const PAGE_SIZE = 20;

export function parsePage(raw?: string): number {
  const n = Number(raw ?? "1");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function buildQueryString(
  filters: ExpenseFilters,
  overrides: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  const merged = { ...filters, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
