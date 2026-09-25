import Link from "next/link";
import type { Metadata } from "next";
import { createExpenseAction } from "@/actions/expenses";
import { ExpenseForm } from "@/components/ExpenseForm";
import { Alert } from "@/components/Alert";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { toDateInputValue } from "@/lib/format";

export const metadata: Metadata = { title: "Shpenzim i re" };

export default async function NewExpensePage() {
  await requireUser();

  const [categories, suppliers] = await Promise.all([
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

  return (
    <>
      <div>
        <Link
          href="/shpenzime"
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          ← Kthehu te shpenzimet
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Shpenzim i re
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Referenca gjenerohet automatikisht pas ruajtjes.
        </p>
      </div>

      {categories.length === 0 ? (
        <Alert kind="warning">
          Nuk ka kategori aktive. Financa duhet të krijojë të paktën një kategori
          para se të regjistrohen shpenzime.
        </Alert>
      ) : (
        <ExpenseForm
          action={createExpenseAction}
          categories={categories}
          suppliers={suppliers}
          cancelHref="/shpenzime"
          values={{
            expenseDate: toDateInputValue(new Date()),
            description: "",
            categoryId: "",
            supplierId: "",
            documentNumber: "",
            amount: "",
            vatRate: "0",
            currency: "ALL",
            paymentMethod: "BANK",
            notes: "",
          }}
        />
      )}
    </>
  );
}
