import type { Prisma } from "@prisma/client";
import { canSeeAll, type CurrentUser } from "@/lib/session";

/** Cilat lëvizje sheh ky përdorues: stafi vetëm arkat e veta dhe hedhjet e veta. */
export function visibleTransactionWhere(
  user: CurrentUser,
): Prisma.TransactionWhereInput {
  if (canSeeAll(user.role)) return {};
  return {
    OR: [
      { account: { ownerId: user.id } },
      { toAccount: { ownerId: user.id } },
      { createdById: user.id },
    ],
  };
}

/** Cilat llogari sheh ky përdorues. */
export function visibleAccountWhere(user: CurrentUser): Prisma.AccountWhereInput {
  if (canSeeAll(user.role)) return {};
  return { ownerId: user.id };
}

/** Fillimi dhe fundi i një muaji, sipas orës lokale. */
export function monthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

export function parsePeriod(params: { muaji?: string; viti?: string }) {
  const now = new Date();
  const month = Number(params.muaji);
  const year = Number(params.viti);
  return {
    month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
  };
}
