import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  buildTransactionWhere,
  type TransactionFilters,
} from "@/lib/transaction-query";
import { SOURCE_LABELS, toNumber } from "@/lib/format";
import { CURRENCY_LABELS, TYPE_LABELS } from "@/lib/transactions";

const HEADERS = [
  "Referenca",
  "Lloji",
  "Data",
  "Përshkrimi",
  "Kategoria",
  "Furnitori",
  "Pala",
  "Nr. dokumenti",
  "Monedha",
  "Pa TVSH",
  "TVSH %",
  "Vlera TVSH",
  "Totali",
  "Nga llogaria",
  "Punonjësi",
  "Te llogaria",
  "Efekti",
  "Prek gjendjen",
  "Regjistruar nga",
  "Burimi",
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

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Pa autorizim" }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters: TransactionFilters = {
    kerko: url.searchParams.get("kerko") ?? undefined,
    lloji: url.searchParams.get("lloji") ?? undefined,
    monedha: url.searchParams.get("monedha") ?? undefined,
    kategori: url.searchParams.get("kategori") ?? undefined,
    punonjesi: url.searchParams.get("punonjesi") ?? undefined,
    nga: url.searchParams.get("nga") ?? undefined,
    deri: url.searchParams.get("deri") ?? undefined,
  };

  const rows = await prisma.transaction.findMany({
    where: buildTransactionWhere(filters, user),
    orderBy: [{ date: "desc" }, { reference: "desc" }],
    take: 10000,
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } },
      account: { select: { name: true, owner: { select: { name: true } } } },
      toAccount: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  const lines = rows.map((t) =>
    [
      t.reference,
      TYPE_LABELS[t.type],
      t.date.toISOString().slice(0, 10),
      t.description,
      t.category?.name ?? "",
      t.supplier?.name ?? "",
      t.counterparty ?? "",
      t.documentNumber ?? "",
      CURRENCY_LABELS[t.currency],
      csvNumber(t.amount),
      csvNumber(t.vatRate),
      csvNumber(t.vatAmount),
      csvNumber(t.totalAmount),
      t.account?.name ?? "",
      t.account?.owner?.name ?? "",
      t.toAccount?.name ?? "",
      csvNumber(t.accountEffect),
      t.affectsBalance ? "Po" : "Jo",
      t.createdBy.name,
      SOURCE_LABELS[t.source] ?? t.source,
    ]
      .map(csvCell)
      .join(";"),
  );

  // BOM + ";" si ndarës, që Excel-i shqip t'i lexojë saktë kolonat dhe shkronjat.
  const csv = `﻿${HEADERS.map(csvCell).join(";")}\r\n${lines.join("\r\n")}\r\n`;
  const fileName = `levizjet-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
