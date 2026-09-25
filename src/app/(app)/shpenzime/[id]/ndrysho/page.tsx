import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { updateExpenseAction } from "@/actions/expenses";
import { ExpenseForm } from "@/components/ExpenseForm";
import { prisma } from "@/lib/db";
import { canApprove, requireUser } from "@/lib/session";
import { toDateInputValue, toNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Ndrysho shpenzimin" };

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) notFound();

  const editable = expense.status === "DRAFT" || expense.status === "REJECTED";
  const allowed =
    expense.createdById === user.id || canApprove(user.role);
  if (!editable || !allowed) redirect(`/shpenzime/${id}?gabim=pa-akses`);

  const [categories, suppliers] = await Promise.all([
    prisma.category.findMany({
      where: { OR: [{ active: true }, { id: expense.categoryId }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.supplier.findMany({
      where: expense.supplierId
        ? { OR: [{ active: true }, { id: expense.supplierId }] }
        : { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <div>
        <Link
          href={`/shpenzime/${id}`}
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          ← Kthehu te shpenzimi
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Ndrysho {expense.reference}
        </h1>
      </div>

      <ExpenseForm
        action={updateExpenseAction}
        categories={categories}
        suppliers={suppliers}
        cancelHref={`/shpenzime/${id}`}
        values={{
          id: expense.id,
          expenseDate: toDateInputValue(expense.expenseDate),
          description: expense.description,
          categoryId: expense.categoryId,
          supplierId: expense.supplierId ?? "",
          documentNumber: expense.documentNumber ?? "",
          amount: String(toNumber(expense.amount)),
          vatRate: String(toNumber(expense.vatRate)),
          currency: expense.currency,
          paymentMethod: expense.paymentMethod,
          notes: expense.notes ?? "",
        }}
      />
    </>
  );
}
