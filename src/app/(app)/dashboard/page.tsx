import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { canSeeAllExpenses, requireUser } from "@/lib/session";
import { formatDate, formatMoney, toNumber } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert } from "@/components/Alert";

export const metadata: Metadata = { title: "Paneli" };

function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ gabim?: string }>;
}) {
  const user = await requireUser();
  const { gabim } = await searchParams;
  const seeAll = canSeeAllExpenses(user.role);
  const scope = seeAll ? {} : { createdById: user.id };
  const { start, end } = monthRange();

  const [monthAgg, yearAgg, pendingAgg, approvedAgg, byCategory, recent] =
    await Promise.all([
      prisma.expense.aggregate({
        where: {
          ...scope,
          status: { in: ["APPROVED", "PAID"] },
          expenseDate: { gte: start, lt: end },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: {
          ...scope,
          status: { in: ["APPROVED", "PAID"] },
          expenseDate: { gte: new Date(new Date().getFullYear(), 0, 1) },
        },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: { ...scope, status: "SUBMITTED" },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { ...scope, status: "APPROVED" },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.expense.groupBy({
        by: ["categoryId"],
        where: {
          ...scope,
          status: { in: ["APPROVED", "PAID"] },
          expenseDate: { gte: start, lt: end },
        },
        _sum: { totalAmount: true },
        orderBy: { _sum: { totalAmount: "desc" } },
        take: 6,
      }),
      prisma.expense.findMany({
        where: scope,
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          category: { select: { name: true } },
          supplier: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
      }),
    ]);

  const categories = byCategory.length
    ? await prisma.category.findMany({
        where: { id: { in: byCategory.map((r) => r.categoryId) } },
        select: { id: true, name: true },
      })
    : [];
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const maxCategory = Math.max(
    1,
    ...byCategory.map((r) => toNumber(r._sum.totalAmount)),
  );

  const monthLabel = new Intl.DateTimeFormat("sq-AL", {
    month: "long",
    year: "numeric",
  }).format(start);

  const cards = [
    {
      label: `Shpenzime ${monthLabel}`,
      value: formatMoney(monthAgg._sum.totalAmount),
      note: `${monthAgg._count} zëra të aprovuar/paguar`,
    },
    {
      label: "Total viti",
      value: formatMoney(yearAgg._sum.totalAmount),
      note: `Nga 1 janar ${new Date().getFullYear()}`,
    },
    {
      label: "Në pritje të aprovimit",
      value: formatMoney(pendingAgg._sum.totalAmount),
      note: `${pendingAgg._count} kërkesa`,
      href: "/shpenzime?status=SUBMITTED",
    },
    {
      label: "Aprovuar, pa paguar",
      value: formatMoney(approvedAgg._sum.totalAmount),
      note: `${approvedAgg._count} zëra për pagesë`,
      href: "/shpenzime?status=APPROVED",
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Përshëndetje, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {seeAll
              ? "Pamje e plotë e shpenzimeve të kompanisë."
              : "Pamje e shpenzimeve që ke regjistruar."}
          </p>
        </div>
        <Link href="/shpenzime/e-re" className="btn-primary">
          + Shpenzim i re
        </Link>
      </div>

      {gabim === "pa-akses" ? (
        <Alert kind="warning">
          Nuk ke të drejta për të hapur atë faqe.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const body = (
            <div className="card h-full p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {card.value}
              </p>
              <p className="mt-1 text-xs text-slate-500">{card.note}</p>
            </div>
          );
          return card.href ? (
            <Link
              key={card.label}
              href={card.href}
              className="block transition hover:-translate-y-0.5"
            >
              {body}
            </Link>
          ) : (
            <div key={card.label}>{body}</div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">Sipas kategorisë — {monthLabel}</h2>
          </div>
          <div className="space-y-4 p-5">
            {byCategory.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nuk ka shpenzime të aprovuara për këtë muaj.
              </p>
            ) : (
              byCategory.map((row) => {
                const value = toNumber(row._sum.totalAmount);
                const pct = Math.round((value / maxCategory) * 100);
                return (
                  <div key={row.categoryId}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-slate-700">
                        {categoryName.get(row.categoryId) ?? "—"}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-600">
                        {formatMoney(value)}
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

        <section className="card lg:col-span-3">
          <div className="card-header">
            <h2 className="card-title">Shpenzimet e fundit</h2>
            <Link
              href="/shpenzime"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Shiko të gjitha →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              Ende nuk është regjistruar asnjë shpenzim.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Referenca</th>
                    <th>Përshkrimi</th>
                    <th>Data</th>
                    <th className="text-right">Totali</th>
                    <th>Statusi</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((expense) => (
                    <tr key={expense.id}>
                      <td className="whitespace-nowrap">
                        <Link
                          href={`/shpenzime/${expense.id}`}
                          className="font-medium text-brand-600 hover:text-brand-700"
                        >
                          {expense.reference}
                        </Link>
                      </td>
                      <td className="max-w-[16rem]">
                        <span className="block truncate font-medium text-slate-800">
                          {expense.description}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {expense.category.name}
                          {expense.supplier ? ` · ${expense.supplier.name}` : ""}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        {formatDate(expense.expenseDate)}
                      </td>
                      <td className="whitespace-nowrap text-right font-medium tabular-nums">
                        {formatMoney(expense.totalAmount, expense.currency)}
                      </td>
                      <td>
                        <StatusBadge status={expense.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
