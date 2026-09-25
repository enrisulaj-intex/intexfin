import type { Account, Currency, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CURRENCY_LABELS, CURRENCIES } from "@/lib/transactions";
import { toNumber } from "@/lib/format";

/** Emri standard i një arke: "Arka në Lekë" etj. */
export function cashBoxName(currency: Currency): string {
  return `Arka në ${CURRENCY_LABELS[currency]}`;
}

/**
 * Siguron që një punonjës të ketë një arkë për çdo monedhë.
 * Thirret kur krijohet përdoruesi dhe nga seed-i; është idempotente.
 */
export async function ensureCashBoxes(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  for (const currency of CURRENCIES) {
    await client.account.upsert({
      where: {
        ownerId_kind_currency: { ownerId: userId, kind: "ARKE", currency },
      },
      update: {},
      create: {
        kind: "ARKE",
        currency,
        name: cashBoxName(currency),
        ownerId: userId,
      },
    });
  }
}

export type AccountBalance = {
  account: Account & { owner?: { id: string; name: string } | null };
  balance: number;
};

/**
 * Gjendja e llogarive: gjendja e hapjes plus efektet e regjistruara.
 * Një lëvizje mund ta prekë një llogari si burim (accountEffect) ose si
 * destinacion (toAccountEffect), ndaj mblidhen të dyja.
 */
export async function getBalances(
  where: Prisma.AccountWhereInput = {},
  upTo?: Date,
): Promise<AccountBalance[]> {
  const dateFilter = upTo ? { date: { lte: upTo } } : {};

  const [accounts, outSums, inSums] = await Promise.all([
    prisma.account.findMany({
      where,
      orderBy: [{ kind: "asc" }, { currency: "asc" }],
      include: { owner: { select: { id: true, name: true } } },
    }),
    prisma.transaction.groupBy({
      by: ["accountId"],
      where: { accountId: { not: null }, ...dateFilter },
      _sum: { accountEffect: true },
    }),
    prisma.transaction.groupBy({
      by: ["toAccountId"],
      where: { toAccountId: { not: null }, ...dateFilter },
      _sum: { toAccountEffect: true },
    }),
  ]);

  const out = new Map(
    outSums.map((r) => [r.accountId as string, toNumber(r._sum.accountEffect)]),
  );
  const incoming = new Map(
    inSums.map((r) => [
      r.toAccountId as string,
      toNumber(r._sum.toAccountEffect),
    ]),
  );

  return accounts.map((account) => ({
    account,
    balance:
      Math.round(
        (toNumber(account.openingBalance) +
          (out.get(account.id) ?? 0) +
          (incoming.get(account.id) ?? 0)) *
          100,
      ) / 100,
  }));
}

/** Gjendja e një llogarie të vetme. */
export async function getBalance(accountId: string, upTo?: Date): Promise<number> {
  const [row] = await getBalances({ id: accountId }, upTo);
  return row?.balance ?? 0;
}

/** Arkat e një punonjësi, të renditura Lek → EUR → USD. */
export async function getUserCashBoxes(userId: string) {
  const order: Record<Currency, number> = { ALL: 0, EUR: 1, USD: 2 };
  const rows = await getBalances({ ownerId: userId, kind: "ARKE" });
  return rows.sort(
    (a, b) => order[a.account.currency] - order[b.account.currency],
  );
}
