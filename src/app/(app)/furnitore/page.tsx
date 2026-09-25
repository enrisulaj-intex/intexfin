import Link from "next/link";
import type { Metadata } from "next";
import { toggleSupplierAction } from "@/actions/suppliers";
import { SubmitButton } from "@/components/SubmitButton";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { formatMoney } from "@/lib/format";
import { SupplierForm } from "./SupplierForm";

export const metadata: Metadata = { title: "Furnitorë" };

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireRole(["ADMIN", "FINANCE"]);
  const { edit } = await searchParams;

  const [suppliers, editing, sums] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { expenses: true } } },
    }),
    edit ? prisma.supplier.findUnique({ where: { id: edit } }) : null,
    prisma.expense.groupBy({
      by: ["supplierId"],
      where: { status: { in: ["APPROVED", "PAID"] } },
      _sum: { totalAmount: true },
    }),
  ]);

  const sumBySupplier = new Map(
    sums
      .filter((s) => s.supplierId)
      .map((s) => [s.supplierId as string, s._sum.totalAmount]),
  );

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Furnitorë
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Regjistri i furnitorëve me të cilët punon Intex Courier.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card h-fit">
          <div className="card-header">
            <h2 className="card-title">
              {editing ? `Ndrysho ${editing.name}` : "Furnitor i re"}
            </h2>
          </div>
          <SupplierForm
            values={{
              id: editing?.id,
              name: editing?.name ?? "",
              nipt: editing?.nipt ?? "",
              email: editing?.email ?? "",
              phone: editing?.phone ?? "",
              address: editing?.address ?? "",
              notes: editing?.notes ?? "",
              active: editing?.active ?? true,
            }}
          />
        </section>

        <section className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">Lista ({suppliers.length})</h2>
          </div>
          {suppliers.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">
              Ende nuk është regjistruar asnjë furnitor.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Emri</th>
                    <th>NIPT</th>
                    <th>Kontakt</th>
                    <th className="text-right">Zëra</th>
                    <th className="text-right">Total aprovuar</th>
                    <th>Statusi</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td className="font-medium text-slate-800">{supplier.name}</td>
                      <td className="whitespace-nowrap font-mono text-xs text-slate-600">
                        {supplier.nipt ?? "—"}
                      </td>
                      <td className="text-xs text-slate-600">
                        {supplier.email ? (
                          <span className="block">{supplier.email}</span>
                        ) : null}
                        {supplier.phone ? (
                          <span className="block">{supplier.phone}</span>
                        ) : null}
                        {!supplier.email && !supplier.phone ? "—" : null}
                      </td>
                      <td className="text-right tabular-nums">
                        {supplier._count.expenses}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {formatMoney(sumBySupplier.get(supplier.id) ?? 0)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            supplier.active
                              ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                              : "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                        >
                          {supplier.active ? "Aktiv" : "Çaktivizuar"}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/furnitore?edit=${supplier.id}`}
                            className="btn-ghost text-xs"
                          >
                            Ndrysho
                          </Link>
                          <form action={toggleSupplierAction}>
                            <input type="hidden" name="id" value={supplier.id} />
                            <SubmitButton className="btn-ghost text-xs">
                              {supplier.active ? "Çaktivizo" : "Aktivizo"}
                            </SubmitButton>
                          </form>
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
