import Link from "next/link";
import type { Metadata } from "next";
import { deleteCategoryAction, toggleCategoryAction } from "@/actions/categories";
import { SubmitButton } from "@/components/SubmitButton";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { formatMoney, toNumber } from "@/lib/format";
import { CategoryForm } from "./CategoryForm";

export const metadata: Metadata = { title: "Kategori" };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requireRole(["ADMIN", "FINANCE"]);
  const { edit } = await searchParams;

  const [categories, editing] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { transactions: true } },
      },
    }),
    edit ? prisma.category.findUnique({ where: { id: edit } }) : null,
  ]);

  // Totali i shpenzimeve sipas kategorisë, vetëm në Lekë.
  const sums = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { type: "SHPENZIM", currency: "ALL" },
    _sum: { totalAmount: true },
  });
  const sumByCategory = new Map(
    sums
      .filter((s) => s.categoryId)
      .map((s) => [s.categoryId as string, toNumber(s._sum.totalAmount)]),
  );

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Kategori shpenzimesh
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kategoritë përcaktojnë se si raportohen shpenzimet e kompanisë.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card h-fit lg:col-span-1">
          <div className="card-header">
            <h2 className="card-title">
              {editing ? `Ndrysho ${editing.code}` : "Kategori e re"}
            </h2>
          </div>
          <CategoryForm
            values={{
              id: editing?.id,
              code: editing?.code ?? "",
              name: editing?.name ?? "",
              description: editing?.description ?? "",
              active: editing?.active ?? true,
            }}
          />
        </section>

        <section className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">Lista ({categories.length})</h2>
          </div>
          {categories.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              Ende nuk është krijuar asnjë kategori.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Kodi</th>
                    <th>Emri</th>
                    <th className="text-right">Zëra</th>
                    <th className="text-right">Total (Lekë)</th>
                    <th>Statusi</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td className="whitespace-nowrap font-mono text-xs font-semibold text-slate-700">
                        {category.code}
                      </td>
                      <td>
                        <span className="block font-medium text-slate-800">
                          {category.name}
                        </span>
                        {category.description ? (
                          <span className="block text-xs text-slate-500">
                            {category.description}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-right tabular-nums">
                        {category._count.transactions}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {formatMoney(sumByCategory.get(category.id) ?? 0)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            category.active
                              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                              : "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                        >
                          {category.active ? "Aktive" : "Çaktivizuar"}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/kategori?edit=${category.id}`}
                            className="btn-ghost text-xs"
                          >
                            Ndrysho
                          </Link>
                          <form action={toggleCategoryAction}>
                            <input type="hidden" name="id" value={category.id} />
                            <SubmitButton className="btn-ghost text-xs">
                              {category.active ? "Çaktivizo" : "Aktivizo"}
                            </SubmitButton>
                          </form>
                          {user.role === "ADMIN" && category._count.transactions === 0 ? (
                            <form action={deleteCategoryAction}>
                              <input type="hidden" name="id" value={category.id} />
                              <SubmitButton
                                className="btn-ghost text-xs text-rose-600 hover:bg-rose-50"
                                confirm={`Të fshihet kategoria ${category.code}?`}
                              >
                                Fshi
                              </SubmitButton>
                            </form>
                          ) : null}
                        </div>
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
