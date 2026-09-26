import type { Currency, TransactionType } from "@prisma/client";

/** Një rresht i lexuar nga skedari, me numrin e rreshtit në skedar. */
export type RawRow = { line: number; cells: Record<string, string> };

export type ParsedFile = {
  headers: string[];
  rows: RawRow[];
};

/** Fushat që njeh sistemi, pavarësisht si janë shkruar në skedar. */
export const FIELDS = [
  "data",
  "pershkrimi",
  "monedha",
  "shuma",
  "tvsh",
  "kategoria",
  "furnitori",
  "dokumenti",
  "pala",
  "punonjesi",
  "llogaria",
  "teLlogaria",
  "drejtimi",
  "vetemPash",
  "shenime",
] as const;

export type Field = (typeof FIELDS)[number];

/** Emrat e pranuar të kolonave. Krahasimi bëhet pa shkronja të mëdha dhe pa theks. */
const HEADER_ALIASES: Record<Field, string[]> = {
  data: ["data", "date", "data e levizjes", "data e shpenzimit"],
  pershkrimi: ["pershkrimi", "pershkrim", "description", "shpjegimi"],
  monedha: ["monedha", "currency", "valuta"],
  shuma: ["shuma", "vlera", "amount", "vlera pa tvsh"],
  tvsh: ["tvsh", "tvsh %", "vat", "norma e tvsh"],
  kategoria: ["kategoria", "kategori", "category"],
  furnitori: ["furnitori", "furnitor", "supplier"],
  dokumenti: ["nr dokumenti", "nr. dokumenti", "dokumenti", "nr fature", "nr. fature", "fatura"],
  pala: ["pala", "klienti", "counterparty", "kush"],
  punonjesi: ["punonjesi", "punonjes", "staf", "arketuesi", "employee", "email"],
  llogaria: ["llogaria", "nga llogaria", "paguar me", "burimi", "arka ose banka"],
  teLlogaria: ["te llogaria", "ne llogarine", "destinacioni", "llogaria bankare", "shkon te"],
  drejtimi: ["drejtimi", "tepri ose mungese", "shenja"],
  vetemPash: ["vetem pash", "vetem per pash", "pash"],
  shenime: ["shenime", "shenim", "notes", "koment"],
};

/** Heq theksat dhe hapësirat e tepërta, që "Përshkrimi" të njësohet me "pershkrimi". */
export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

const HEADER_LOOKUP = new Map<string, Field>();
for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
  for (const alias of aliases) {
    HEADER_LOOKUP.set(normalizeHeader(alias), field as Field);
  }
}

export function matchField(header: string): Field | null {
  return HEADER_LOOKUP.get(normalizeHeader(header)) ?? null;
}

/* ------------------------------------------------------------------ */
/* Leximi i skedarëve                                                  */
/* ------------------------------------------------------------------ */

/** Ndan një rresht CSV duke respektuar thonjëzat. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/** Gjen ndarësin duke numëruar shfaqjet jashtë thonjëzave në rreshtin e parë. */
function detectDelimiter(headerLine: string): string {
  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = splitCsvLine(headerLine, candidate).length;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

function parseCsv(text: string): ParsedFile {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter);

  const rows: RawRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i], delimiter);
    const cells: Record<string, string> = {};
    headers.forEach((header, index) => {
      const field = matchField(header);
      if (field) cells[field] = values[index] ?? "";
    });
    // Rreshtat krejt bosh nuk raportohen si gabim.
    if (Object.values(cells).some((v) => v !== "")) {
      rows.push({ line: i + 1, cells });
    }
  }
  return { headers, rows };
}

async function parseXlsx(buffer: Buffer): Promise<ParsedFile> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const cellText = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === "object") {
      const rich = value as { text?: string; result?: unknown; hyperlink?: string };
      if (typeof rich.text === "string") return rich.text;
      if (rich.result !== undefined) return String(rich.result);
      return "";
    }
    return String(value);
  };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  const fieldByColumn = new Map<number, Field>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = cellText(cell.value);
    headers.push(header);
    const field = matchField(header);
    if (field) fieldByColumn.set(colNumber, field);
  });

  const rows: RawRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells: Record<string, string> = {};
    for (const [colNumber, field] of fieldByColumn) {
      cells[field] = cellText(row.getCell(colNumber).value).trim();
    }
    if (Object.values(cells).some((v) => v !== "")) {
      rows.push({ line: rowNumber, cells });
    }
  });

  return { headers, rows };
}

export const MAX_IMPORT_ROWS = 2000;

export async function parseImportFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    return parseXlsx(buffer);
  }
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCsv(buffer.toString("utf8"));
  }
  if (name.endsWith(".xls")) {
    throw new Error(
      "Formati .xls (Excel i vjetër) nuk lexohet. Ruaje si .xlsx ose .csv.",
    );
  }
  throw new Error("Prano vetëm skedarë .xlsx ose .csv.");
}

/* ------------------------------------------------------------------ */
/* Normalizimi i vlerave                                               */
/* ------------------------------------------------------------------ */

/** Pranon "1250.50", "1250,50" dhe "1.250,50" */
export function parseAmountCell(raw: string): number {
  let s = raw.trim().replace(/[\s ]/g, "").replace(/[€$L]/gi, "");
  if (s === "") return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  return Number(s);
}

/** Pranon 2026-09-25, 25.09.2026, 25/09/2026 dhe numrat serialë të Excel-it. */
export function parseDateCell(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
  }

  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(s);
  if (dmy) {
    const year = Number(dmy[3]) < 100 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return new Date(year, Number(dmy[2]) - 1, Number(dmy[1]), 12);
  }

  // Numri serial i Excel-it (ditë nga 30.12.1899)
  if (/^\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 60000) {
      const base = Date.UTC(1899, 11, 30);
      return new Date(base + serial * 86400000);
    }
  }
  return null;
}

const CURRENCY_ALIASES: Record<string, Currency> = {
  all: "ALL", lek: "ALL", leke: "ALL", l: "ALL", lekë: "ALL",
  eur: "EUR", euro: "EUR", "€": "EUR",
  usd: "USD", dollar: "USD", dollare: "USD", "$": "USD",
};

export function parseCurrencyCell(raw: string): Currency | null {
  const key = normalizeHeader(raw);
  return CURRENCY_ALIASES[key] ?? null;
}

export function parseBooleanCell(raw: string): boolean {
  const key = normalizeHeader(raw);
  return ["po", "yes", "true", "1", "x"].includes(key);
}

/** "Tepricë" → true (+), "Mungesë" → false (−) */
export function parseDirectionCell(raw: string): boolean | null {
  const key = normalizeHeader(raw);
  if (["teprice", "tepri", "plus", "+", "shtese"].includes(key)) return true;
  if (["mungese", "minus", "-", "diference negative"].includes(key)) return false;
  return null;
}

/** ARKE ose BANKE, nga tekste si "Arka", "Kesh", "Bankë". */
export function parseAccountKindCell(raw: string): "ARKE" | "BANKE" | null {
  const key = normalizeHeader(raw);
  if (!key) return null;
  if (["arke", "arka", "kesh", "cash", "para ne dore"].includes(key)) return "ARKE";
  if (["banke", "banka", "bank", "transferte bankare"].includes(key)) return "BANKE";
  return null;
}

/* ------------------------------------------------------------------ */
/* Kolonat e kërkuara sipas llojit                                     */
/* ------------------------------------------------------------------ */

export const REQUIRED_FIELDS: Record<TransactionType, Field[]> = {
  SHPENZIM: ["data", "pershkrimi", "monedha", "shuma"],
  ARKETIM: ["data", "pershkrimi", "monedha", "shuma"],
  E_DREJTE: ["data", "pershkrimi", "monedha", "shuma"],
  DEPOZITIM: ["data", "pershkrimi", "monedha", "shuma", "teLlogaria"],
  TRANSFERTE: ["data", "pershkrimi", "monedha", "shuma", "teLlogaria"],
  DIFERENCE: ["data", "pershkrimi", "monedha", "shuma", "drejtimi"],
};

export const OPTIONAL_FIELDS: Record<TransactionType, Field[]> = {
  SHPENZIM: ["tvsh", "kategoria", "furnitori", "dokumenti", "punonjesi", "llogaria", "vetemPash", "shenime"],
  ARKETIM: ["kategoria", "pala", "dokumenti", "punonjesi", "llogaria", "shenime"],
  E_DREJTE: ["tvsh", "kategoria", "pala", "dokumenti", "punonjesi", "shenime"],
  DEPOZITIM: ["dokumenti", "punonjesi", "shenime"],
  TRANSFERTE: ["dokumenti", "punonjesi", "llogaria", "shenime"],
  DIFERENCE: ["punonjesi", "llogaria", "shenime"],
};

export const FIELD_LABELS: Record<Field, string> = {
  data: "Data",
  pershkrimi: "Përshkrimi",
  monedha: "Monedha",
  shuma: "Shuma",
  tvsh: "TVSH %",
  kategoria: "Kategoria",
  furnitori: "Furnitori",
  dokumenti: "Nr. dokumenti",
  pala: "Pala",
  punonjesi: "Punonjësi",
  llogaria: "Llogaria",
  teLlogaria: "Te llogaria",
  drejtimi: "Drejtimi",
  vetemPash: "Vetëm PASH",
  shenime: "Shënime",
};

/** Kolonat e shabllonit për një lloj: të detyrueshmet, pastaj opsionalet. */
export function templateColumns(type: TransactionType): Field[] {
  return [...REQUIRED_FIELDS[type], ...OPTIONAL_FIELDS[type]];
}
