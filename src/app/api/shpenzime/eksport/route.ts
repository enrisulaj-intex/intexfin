import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { buildExpenseWhere, type ExpenseFilters } from "@/lib/expense-query";
import { PAYMENT_LABELS, STATUS_LABELS, toNumber } from "@/lib/format";

const HEADERS = [
  "Referenca",
  "Data",
  "Përshkrimi",
  "Kategoria",
  "Furnitori",
  "NIPT",
  "Nr. dokumenti",
  "Pa TVSH",
  "TVSH %",
  "Vlera TVSH",
  "Totali",
  "Monedha",
  "Mënyra e pagesës",
  "Statusi",
  "Regjistruar nga",
  "Aprovuar nga",
  "Data e pagesës",
];

/** Escape për CSV: thonjëzat dyfishohen, fusha rrethohet me thonjëza. */
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Numrat me presje dhjetore, si i pret Excel-i me lokalizim shqip. */
function csvNumber(value: Parameters<typeof toNumber>[0]): string {
  return toNumber(value).toFixed(2).replace(".", ",");
}

function csvDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Pa autorizim" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters: ExpenseFilters = {
    kerko: url.searchParams.get("kerko") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    kategori: url.searchParams.get("kategori") ?? undefined,
    furnitor: url.searchParams.get("furnitor") ?? undefined,
    nga: url.searchParams.get("nga") ?? undefined,
    deri: url.searchParams.get("deri") ?? undefined,
  };

  const expenses = await prisma.expense.findMany({
    where: buildExpenseWhere(filters, user),
    orderBy: [{ expenseDate: "desc" }, { reference: "desc" }],
    take: 5000,
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true, nipt: true } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
  });

  const rows = expenses.map((e) =>
    [
      e.reference,
      csvDate(e.expenseDate),
      e.description,
      e.category.name,
      e.supplier?.name ?? "",
      e.supplier?.nipt ?? "",
      e.documentNumber ?? "",
      csvNumber(e.amount),
      csvNumber(e.vatRate),
      csvNumber(e.vatAmount),
      csvNumber(e.totalAmount),
      e.currency,
      PAYMENT_LABELS[e.paymentMethod] ?? e.paymentMethod,
      STATUS_LABELS[e.status] ?? e.status,
      e.createdBy.name,
      e.approvedBy?.name ?? "",
      csvDate(e.paidAt),
    ].map(csvCell).join(";"),
  );

  // BOM + ";" si ndarës, që Excel-i shqip t'i lexojë saktë kolonat dhe shkronjat.
  const csv = `﻿${HEADERS.map(csvCell).join(";")}\r\n${rows.join("\r\n")}\r\n`;
  const fileName = `shpenzime-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
