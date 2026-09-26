import Link from "next/link";
import type { Metadata } from "next";
import type { Currency } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canSeeAll, requireUser } from "@/lib/session";
import { getBalances } from "@/lib/accounts";
import { getEntryFormData } from "@/lib/entry-data";
import {
  monthRange,
  parsePeriod,
  visibleAccountWhere,
  visibleTransactionWhere,
} from "@/lib/scope";
import {
  MONTHS_SQ,
  formatDate,
  formatMoney,
  formatSigned,
  toDateInputValue,
  toNumber,
} from "@/lib/format";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  TYPE_LABELS,
  TYPE_STYLES,
} from "@/lib/transactions";
import { QuickEntry } from "@/components/QuickEntry";
import { Alert } from "@/components/Alert";

export const metadata: Metadata = { title: "Arka & Cash-Flow" };

type Search = { muaji?: string; viti?: string; gabim?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const { month, year } = parsePeriod(params);
  const { start, end } = monthRange(year, month);
  const beforeStart = new Date(start.getTime() - 1);

  const txScope = visibleTransactionWhere(user);
  const accScope = visibleAccountWhere(user);
  const seeAll = canSeeAll(user.role);

  const [openingRows, closingRows, flows, byCategory, recent, receivables] =
    await Promise.all([
      getBalances({ ...accScope, kind: "ARKE" }, beforeStart),
      getBalances({ ...accScope, kind: "ARKE" }, end),
      prisma.transaction.groupBy({
        by: ["type", "currency"],
        where: { ...txScope, date: { gte: start, lt: end } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.transaction.groupBy({
        by: ["categoryId", "currency"],
        where: {
          ...txScope,
          type: "SHPENZIM",
          date: { gte: start, lt: end },
          categoryId: { not: null },
        },
        _sum: { totalAmount: true },
        orderBy: { _sum: { totalAmount: "desc" } },
        take: 8,
      }),
      prisma.transaction.findMany({
        where: txScope,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 10,
        include: {
          category: { select: { name: true } },
          account: { select: { name: true, owner: { select: { name: true } } } },
          createdBy: { select: { name: true } },
        },
      }),
      prisma.transaction.findMany({
        where: { ...txScope, type: "E_DREJTE", settledAt: null },
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

  // Përmbledhje sipas monedhës
  const sumBy = (type: string, currency: Currency) =>
    toNumber(
      flows.find((f) => f.type === type && f.currency === currency)?._sum
        .totalAmount,
    );

  const perCurrency = CURRENCIES.map((currency) => {
    const opening = openingRows
      .filter((r) => r.account.currency === currency)
      .reduce((sum, r) => sum + r.balance, 0);
    const closing = closingRows
      .filter((r) => r.account.currency === currency)
      .reduce((sum, r) => sum + r.balance, 0);
    return {
      currency,
      opening,
      closing,
      arketime: sumBy("ARKETIM", currency),
      shpenzime: sumBy("SHPENZIM", currency),
      depozitime: sumBy("DEPOZITIM", currency),
      teDrejta: receivables
        .filter((r) => r.currency === currency)
        .reduce((sum, r) => sum + toNumber(r.totalAmount), 0),
    };
  }).filter(
    (row) =>
      row.currency === "ALL" ||
      row.opening !== 0 ||
      row.closing !== 0 ||
      row.arketime !== 0 ||
      row.shpenzime !== 0 ||
      row.teDrejta !== 0,
  );

  const categoryIds = byCategory
    .map((r) => r.categoryId)
    .filter((id): id is string => Boolean(id));
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const maxCategory = Math.max(
    1,
    ...byCategory.map((r) => toNumber(r._sum.totalAmount)),
  );

  // Të dhënat e panelit të shpejtë ndahen me formularin e plotë te /ngarkim.
  const entryData = await getEntryFormData(user);
  const bankRows = seeAll ? await getBalances({ kind: "BANKE", active: true }) : [];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Arka & Cash-Flow
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {seeAll
              ? "Gjendja e arkave të të gjithë punonjësve dhe lëvizjet e periudhës."
              : "Gjendja e arkave të tua dhe lëvizjet e periudhës."}
          </p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="muaji">Muaji</label>
            <select id="muaji" name="muaji" defaultValue={String(month)} className="input">
              {MONTHS_SQ.map((label, index) => (
                <option key={label} value={index + 1}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="viti">Viti</label>
            <select id="viti" name="viti" defaultValue={String(year)} className="input">
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-secondary">Shfaq</button>
        </form>
      </div>

      {params.gabim === "pa-akses" ? (
        <Alert kind="warning">Nuk ke të drejta për atë faqe.</Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Gjendja e arkave sipas monedhës */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {perCurrency.map((row) => (
              <section key={row.currency} className="card p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Arka në {CURRENCY_LABELS[row.currency]}
                  </h2>
                </div>
                <p
                  className={`mt-2 text-2xl font-semibold tracking-tight ${
                    row.closing < 0 ? "text-rose-600" : "text-slate-900"
                  }`}
                >
                  {formatMoney(row.closing, row.currency)}
                </p>
                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Teprica e mëparshme</dt>
                    <dd className="tabular-nums text-slate-700">
                      {formatMoney(row.opening, row.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Arkëtime</dt>
                    <dd className="tabular-nums text-emerald-700">
                      {formatSigned(row.arketime, row.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Shpenzime</dt>
                    <dd className="tabular-nums text-rose-700">
                      {formatSigned(-row.shpenzime, row.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Depozitime në bankë</dt>
                    <dd className="tabular-nums text-slate-700">
                      {formatSigned(-row.depozitime, row.currency)}
                    </dd>
                  </div>
                  {row.teDrejta > 0 ? (
                    <div className="flex justify-between gap-3 border-t border-slate-100 pt-1.5">
                      <dt className="text-slate-500">Të drejta për t&apos;u arkëtuar</dt>
                      <dd className="tabular-nums text-amber-700">
                        {formatMoney(row.teDrejta, row.currency)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ))}
          </div>

          {/* Banka */}
          {seeAll && bankRows.length > 0 ? (
            <section className="card">
              <div className="card-header">
                <h2 className="card-title">Llogaritë bankare</h2>
                <Link href="/arka" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                  Menaxho →
                </Link>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Llogaria</th>
                      <th>Monedha</th>
                      <th className="text-right">Gjendja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankRows.map((row) => (
                      <tr key={row.account.id}>
                        <td className="font-medium text-slate-800">{row.account.name}</td>
                        <td>{CURRENCY_LABELS[row.account.currency]}</td>
                        <td className="text-right font-semibold tabular-nums">
                          {formatMoney(row.balance, row.account.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* Shpenzimet sipas kategorisë */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">
                Shpenzimet sipas kategorisë — {MONTHS_SQ[month - 1]} {year}
              </h2>
            </div>
            <div className="space-y-4 p-5">
              {byCategory.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nuk ka shpenzime të regjistruara për këtë periudhë.
                </p>
              ) : (
                byCategory.map((row) => {
                  const value = toNumber(row._sum.totalAmount);
                  const pct = Math.round((value / maxCategory) * 100);
                  return (
                    <div key={`${row.categoryId}-${row.currency}`}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-slate-700">
                          {categoryName.get(row.categoryId as string) ?? "—"}
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-600">
                          {formatMoney(value, row.currency)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Lëvizjet e fundit */}
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Lëvizjet e fundit</h2>
              <Link href="/levizjet" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Shiko të gjitha →
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">
                Ende nuk është regjistruar asnjë lëvizje.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Referenca</th>
                      <th>Përshkrimi</th>
                      <th>Data</th>
                      <th>Arka</th>
                      <th className="text-right">Vlera</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((t) => (
                      <tr key={t.id}>
                        <td className="whitespace-nowrap">
                          <Link
                            href={`/levizjet/${t.id}`}
                            className="font-medium text-brand-600 hover:text-brand-700"
                          >
                            {t.reference}
                          </Link>
                          <span className={`badge ml-1.5 ${TYPE_STYLES[t.type]}`}>
                            {TYPE_LABELS[t.type]}
                          </span>
                        </td>
                        <td className="max-w-[16rem]">
                          <span className="block truncate font-medium text-slate-800">
                            {t.description}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {t.category?.name ?? "Pa kategori"} · {t.createdBy.name}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="whitespace-nowrap text-xs text-slate-500">
                          {t.account?.owner?.name ?? t.account?.name ?? "—"}
                        </td>
                        <td className="whitespace-nowrap text-right font-semibold tabular-nums">
                          {formatMoney(t.totalAmount, t.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Paneli i shpejtë */}
        <aside className="xl:sticky xl:top-6 xl:h-fit">
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Shto lëvizje</h2>
            </div>
            <QuickEntry
              today={toDateInputValue(new Date())}
              currentUserId={user.id}
              {...entryData}
            />
          </section>
        </aside>
      </div>
    </>
  );
}
