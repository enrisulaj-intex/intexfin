import { prisma } from "@/lib/db";
import { getBalances } from "@/lib/accounts";
import { canSeeAll, type CurrentUser } from "@/lib/session";
import { visibleTransactionWhere } from "@/lib/scope";
import { toNumber } from "@/lib/format";
import type {
  BankOption,
  CashBoxOption,
  ReceivableOption,
} from "@/components/QuickEntry";

export type EntryFormData = {
  owners: { id: string; name: string }[];
  cashBoxes: CashBoxOption[];
  bankAccounts: BankOption[];
  categories: string[];
  suppliers: { id: string; name: string }[];
  receivables: ReceivableOption[];
};

/**
 * Të dhënat që u duhen të dy formularëve të hedhjes — panelit të shpejtë
 * dhe formularit të plotë — që të mos shkruhen dy herë.
 */
export async function getEntryFormData(user: CurrentUser): Promise<EntryFormData> {
  const seeAll = canSeeAll(user.role);

  const [owners, cashRows, bankRows, categories, suppliers, receivables] =
    await Promise.all([
      seeAll
        ? prisma.user.findMany({
            where: { active: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([{ id: user.id, name: user.name }]),
      getBalances({ kind: "ARKE", ...(seeAll ? {} : { ownerId: user.id }) }),
      getBalances({ kind: "BANKE", active: true }),
      prisma.category.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { name: true },
      }),
      prisma.supplier.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.transaction.findMany({
        where: {
          ...visibleTransactionWhere(user),
          type: "E_DREJTE",
          settledAt: null,
        },
        orderBy: { date: "asc" },
        select: {
          id: true,
          reference: true,
          description: true,
          currency: true,
          totalAmount: true,
        },
      }),
    ]);

  return {
    owners,
    cashBoxes: cashRows.map((row) => ({
      id: row.account.id,
      ownerId: row.account.ownerId as string,
      ownerName: row.account.owner?.name ?? "—",
      currency: row.account.currency,
      balance: row.balance,
    })),
    bankAccounts: bankRows.map((row) => ({
      id: row.account.id,
      name: row.account.name,
      currency: row.account.currency,
      // Stafi duhet ta zgjedhë llogarinë për depozitim, por gjendja e
      // bankës nuk i tregohet.
      balance: seeAll ? row.balance : null,
    })),
    categories: categories.map((c) => c.name),
    suppliers,
    receivables: receivables.map((r) => ({
      id: r.id,
      reference: r.reference,
      description: r.description,
      currency: r.currency,
      total: toNumber(r.totalAmount),
    })),
  };
}
