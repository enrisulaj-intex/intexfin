import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { canSeeAll, requireUser } from "@/lib/session";
import { formatDate, formatMoney, toNumber } from "@/lib/format";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  TRANSACTION_TYPES,
  TYPE_LABELS,
  TYPE_STYLES,
} from "@/lib/transactions";
import {
  PAGE_SIZE,
  buildQueryString,
  buildTransactionWhere,
  parsePage,
  type TransactionFilters,
} from "@/lib/transaction-query";
import { Alert } from "@/components/Alert";

export const metadata: Metadata = { title: "Lëvizjet" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<TransactionFilters & { mesazh?: string; gabim?: string }>;
}) {
  const user = await requireUser();
  const filters = await searchParams;
  const page = parsePage(filters.faqe);
  const where = buildTransactionWhere(filters, user);
  const seeAll = canSeeAll(user.role);

  const [total, sums, rows, categories, employees] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({
      by: ["currency"],
      where,
      _sum: { totalAmount: true },
    }),
    prisma.transaction.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true } },
        account: { select: { name: true, kind: true, owner: { select: { name: true } } } },
        toAccount: { select: { name: true } },
        createdBy: { select: { name: true } },
        _count: { select: { attachments: true } },
      },
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    seeAll
      ? prisma.user.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(
    filters.kerko || filters.lloji || filters.monedha || filters.kategori ||
      filters.punonjesi || filters.nga || filters.deri,
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Lëvizjet
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} lëvizje ·{" "}
            {sums
              .map((s) => formatMoney(toNumber(s._sum.totalAmount), s.currency))
              .join(" · ") || "0"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/api/levizjet/eksport${buildQueryString(filters, { faqe: undefined })}`}
            className="btn-secondary"
            prefetch={false}
          >
            Eksporto CSV
          </Link>
          <Link href="/dashboard" className="btn-primary">
            + Shto lëvizje
          </Link>
        </div>
      </div>

      {filters.mesazh === "fshire" ? (
        <Alert kind="success">Lëvizja u fshi dhe gjendja u rillogarit.</Alert>
      ) : null}
      {filters.gabim === "nuk-u-gjet" ? (
        <Alert kind="error">Lëvizja nuk u gjet.</Alert>
      ) : null}

      <form method="get" className="card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="label" htmlFor="kerko">Kërko</label>
            <input
              id="kerko"
              name="kerko"
              defaultValue={filters.kerko ?? ""}
              className="input"
              placeholder="Referencë, përshkrim, nr. dokumenti…"
            />
          </div>
          <div>
            <label className="label" htmlFor="lloji">Lloji</label>
            <select id="lloji" name="lloji" defaultValue={filters.lloji ?? ""} className="input">
              <option value="">Të gjitha</option>
              {TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="monedha">Monedha</label>
            <select id="monedha" name="monedha" defaultValue={filters.monedha ?? ""} className="input">
              <option value="">Të gjitha</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{CURRENCY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="nga">Nga data</label>
            <input id="nga" name="nga" type="date" defaultValue={filters.nga ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="deri">Deri më</label>
            <input id="deri" name="deri" type="date" defaultValue={filters.deri ?? ""} className="input" />
          </div>
          <div className="lg:col-span-2">
            <label className="label" htmlFor="kategori">Kategoria</label>
            <select id="kategori" name="kategori" defaultValue={filters.kategori ?? ""} className="input">
              <option value="">Të gjitha</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {seeAll ? (
            <div className="lg:col-span-2">
              <label className="label" htmlFor="punonjesi">Punonjësi</label>
              <select id="punonjesi" name="punonjesi" defaultValue={filters.punonjesi ?? ""} className="input">
                <option value="">Të gjithë</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex items-end gap-2 lg:col-span-2">
            <button type="submit" className="btn-primary">Filtro</button>
            {hasFilters ? (
              <Link href="/levizjet" className="btn-secondary">Hiq filtrat</Link>
            ) : null}
          </div>
        </div>
      </form>

      <section className="card">
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              Nuk u gjet asnjë lëvizje.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {hasFilters
                ? "Provo t'i zgjerosh filtrat."
                : "Hidh lëvizjen e parë nga paneli te faqja kryesore."}
            </p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Referenca</th>
                    <th>Lloji</th>
                    <th>Përshkrimi</th>
                    <th>Data</th>
                    <th>Llogaria</th>
                    <th className="text-right">Vlera</th>
                    <th className="text-right">Efekti</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const effect = toNumber(t.accountEffect);
                    return (
                      <tr key={t.id}>
                        <td className="whitespace-nowrap">
                          <Link
                            href={`/levizjet/${t.id}`}
                            className="font-medium text-brand-600 hover:text-brand-700"
                          >
                            {t.reference}
                          </Link>
                          {t._count.attachments > 0 ? (
                            <span className="ml-1.5 text-xs text-slate-400">
                              📎{t._count.attachments}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <span className={`badge ${TYPE_STYLES[t.type]}`}>
                            {TYPE_LABELS[t.type]}
                          </span>
                        </td>
                        <td className="max-w-[18rem]">
                          <span className="block truncate font-medium text-slate-800">
                            {t.description}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {t.category?.name ?? "Pa kategori"}
                            {t.supplier ? ` · ${t.supplier.name}` : ""} ·{" "}
                            {t.createdBy.name}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">{formatDate(t.date)}</td>
                        <td className="whitespace-nowrap text-xs text-slate-600">
                          {t.account
                            ? t.account.kind === "ARKE"
                              ? `Arka · ${t.account.owner?.name ?? "—"}`
                              : t.account.name
                            : "—"}
                          {t.toAccount ? ` → ${t.toAccount.name}` : ""}
                        </td>
                        <td className="whitespace-nowrap text-right font-medium tabular-nums">
                          {formatMoney(t.totalAmount, t.currency)}
                        </td>
                        <td
                          className={`whitespace-nowrap text-right font-semibold tabular-nums ${
                            effect > 0
                              ? "text-emerald-700"
                              : effect < 0
                                ? "text-rose-700"
                                : "text-slate-400"
                          }`}
                        >
                          {effect === 0
                            ? "—"
                            : `${effect > 0 ? "+" : ""}${formatMoney(effect, t.currency)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pages > 1 ? (
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm">
                <span className="text-slate-500">Faqja {page} nga {pages}</span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={`/levizjet${buildQueryString(filters, { faqe: String(page - 1) })}`}
                      className="btn-secondary"
                    >
                      ← E mëparshme
                    </Link>
                  ) : null}
                  {page < pages ? (
                    <Link
                      href={`/levizjet${buildQueryString(filters, { faqe: String(page + 1) })}`}
                      className="btn-secondary"
                    >
                      Tjetra →
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
