import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { formatDate, formatMoney, PAYMENT_LABELS, STATUS_LABELS } from "@/lib/format";
import {
  PAGE_SIZE,
  buildExpenseWhere,
  buildQueryString,
  parsePage,
  type ExpenseFilters,
} from "@/lib/expense-query";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert } from "@/components/Alert";

export const metadata: Metadata = { title: "Shpenzime" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<ExpenseFilters & { mesazh?: string; gabim?: string }>;
}) {
  const user = await requireUser();
  const filters = await searchParams;
  const page = parsePage(filters.faqe);
  const where = buildExpenseWhere(filters, user);

  const [total, sums, expenses, categories, suppliers] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { totalAmount: true } }),
    prisma.expense.findMany({
      where,
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true } },
        createdBy: { select: { name: true } },
        _count: { select: { attachments: true } },
      },
    }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.supplier.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = "/shpenzime";
  const hasFilters = Boolean(
    filters.kerko || filters.status || filters.kategori || filters.furnitor ||
      filters.nga || filters.deri,
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Shpenzime
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} zëra · totali {formatMoney(sums._sum.totalAmount)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/api/shpenzime/eksport${buildQueryString(filters, { faqe: undefined })}`}
            className="btn-secondary"
            prefetch={false}
          >
            Eksporto CSV
          </Link>
          <Link href="/shpenzime/e-re" className="btn-primary">
            + Shpenzim i re
          </Link>
        </div>
      </div>

      {filters.mesazh === "fshire" ? (
        <Alert kind="success">Shpenzimi u fshi.</Alert>
      ) : null}
      {filters.gabim === "nuk-u-gjet" ? (
        <Alert kind="error">Shpenzimi nuk u gjet.</Alert>
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
              placeholder="Referencë, përshkrim, nr. fature…"
            />
          </div>
          <div>
            <label className="label" htmlFor="status">Statusi</label>
            <select id="status" name="status" defaultValue={filters.status ?? ""} className="input">
              <option value="">Të gjitha</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="kategori">Kategoria</label>
            <select id="kategori" name="kategori" defaultValue={filters.kategori ?? ""} className="input">
              <option value="">Të gjitha</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
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
            <label className="label" htmlFor="furnitor">Furnitori</label>
            <select id="furnitor" name="furnitor" defaultValue={filters.furnitor ?? ""} className="input">
              <option value="">Të gjithë</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <button type="submit" className="btn-primary">Filtro</button>
            {hasFilters ? (
              <Link href={base} className="btn-secondary">Hiq filtrat</Link>
            ) : null}
          </div>
        </div>
      </form>

      <section className="card">
        {expenses.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              Nuk u gjet asnjë shpenzim.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {hasFilters
                ? "Provo t'i zgjerosh filtrat."
                : "Fillo duke regjistruar shpenzimin e parë."}
            </p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Referenca</th>
                    <th>Përshkrimi</th>
                    <th>Kategoria</th>
                    <th>Data</th>
                    <th className="text-right">Pa TVSH</th>
                    <th className="text-right">Totali</th>
                    <th>Pagesa</th>
                    <th>Statusi</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="whitespace-nowrap">
                        <Link
                          href={`/shpenzime/${expense.id}`}
                          className="font-medium text-brand-600 hover:text-brand-700"
                        >
                          {expense.reference}
                        </Link>
                        {expense._count.attachments > 0 ? (
                          <span
                            className="ml-1.5 text-xs text-slate-400"
                            title={`${expense._count.attachments} dokument(e)`}
                          >
                            📎{expense._count.attachments}
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[18rem]">
                        <span className="block truncate font-medium text-slate-800">
                          {expense.description}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {expense.supplier?.name ?? "Pa furnitor"} ·{" "}
                          {expense.createdBy.name}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">{expense.category.name}</td>
                      <td className="whitespace-nowrap">{formatDate(expense.expenseDate)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {formatMoney(expense.amount, expense.currency)}
                      </td>
                      <td className="whitespace-nowrap text-right font-semibold tabular-nums">
                        {formatMoney(expense.totalAmount, expense.currency)}
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        {PAYMENT_LABELS[expense.paymentMethod]}
                      </td>
                      <td><StatusBadge status={expense.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 ? (
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm">
                <span className="text-slate-500">
                  Faqja {page} nga {pages}
                </span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={`${base}${buildQueryString(filters, { faqe: String(page - 1) })}`}
                      className="btn-secondary"
                    >
                      ← E mëparshme
                    </Link>
                  ) : null}
                  {page < pages ? (
                    <Link
                      href={`${base}${buildQueryString(filters, { faqe: String(page + 1) })}`}
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
