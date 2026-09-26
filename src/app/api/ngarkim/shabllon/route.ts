import { NextResponse } from "next/server";
import type { TransactionType } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { FIELD_LABELS, templateColumns, type Field } from "@/lib/import-parse";
import { TYPE_LABELS } from "@/lib/transactions";

const TYPES: TransactionType[] = [
  "SHPENZIM", "ARKETIM", "DEPOZITIM", "E_DREJTE", "DIFERENCE", "TRANSFERTE",
];

/** Përshkrimi i shembullit ndryshon sipas llojit, që rreshti të ketë kuptim. */
const EXAMPLE_DESCRIPTIONS: Record<TransactionType, string> = {
  SHPENZIM: "Karburant për furgonat",
  ARKETIM: "Arkëtime COD — rajoni Tiranë",
  DEPOZITIM: "Derdhje e arkëtimeve në bankë",
  E_DREJTE: "Faturë klienti — dërgesa korporative",
  DIFERENCE: "Mungesë në numërimin e arkës",
  TRANSFERTE: "Dorëzim parash te kolegu",
};

/** Një rresht shembull, që formati i çdo kolone të jetë i qartë. */
const EXAMPLES: Partial<Record<Field, string>> = {
  data: "25.09.2026",
  monedha: "Lek",
  shuma: "12500.00",
  tvsh: "20",
  kategoria: "Karburant",
  furnitori: "Kastrati sh.a.",
  dokumenti: "2026/0451",
  pala: "Alba Logistics shpk",
  punonjesi: "arjan.hoxha@intexcourier.al",
  llogaria: "Arkë",
  teLlogaria: "BKT — Lek",
  drejtimi: "Mungesë",
  vetemPash: "Jo",
  shenime: "",
};

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Pa autorizim" }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get("lloji");
  const type = TYPES.find((t) => t === raw);
  if (!type) {
    return NextResponse.json({ error: "Lloj i panjohur" }, { status: 400 });
  }

  const columns = templateColumns(type);
  const header = columns.map((c) => csvCell(FIELD_LABELS[c])).join(";");
  const example = columns
    .map((c) =>
      csvCell(c === "pershkrimi" ? EXAMPLE_DESCRIPTIONS[type] : EXAMPLES[c] ?? ""),
    )
    .join(";");

  // BOM + ";" që Excel-i shqip ta hapë me kolonat e ndara saktë.
  const csv = `﻿${header}\r\n${example}\r\n`;
  const slug = TYPE_LABELS[type].toLowerCase().replace(/[^a-z]+/g, "-");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shabllon-${slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
