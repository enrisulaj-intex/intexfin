/**
 * Mbush bazën e të dhënave me të dhëna fillestare:
 * përdoruesit bazë me arkat e tyre (Lek, EUR, USD), llogaritë bankare,
 * kategoritë tipike të një kompanie korriere, furnitorët dhe disa lëvizje.
 *
 * Ekzekuto: npm run db:seed
 */
import { PrismaClient, Prisma, type Currency, type TransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@intexcourier.al";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Intex2026!";

const CURRENCIES: Currency[] = ["ALL", "EUR", "USD"];
const CURRENCY_LABELS: Record<Currency, string> = {
  ALL: "Lekë",
  EUR: "Euro",
  USD: "Dollarë",
};
const TYPE_PREFIX: Record<TransactionType, string> = {
  SHPENZIM: "SHP",
  ARKETIM: "ARK",
  DEPOZITIM: "DEP",
  E_DREJTE: "DRJ",
  DIFERENCE: "DIF",
  TRANSFERTE: "TRF",
};

const CATEGORIES = [
  { code: "KARBURANT", name: "Karburant", description: "Naftë dhe benzinë për flotën" },
  { code: "MIREMBAJTJE", name: "Mirëmbajtje mjetesh", description: "Servis, goma, pjesë këmbimi" },
  { code: "QIRA", name: "Qira", description: "Zyra, magazina, pika shpërndarjeje" },
  { code: "PAGA", name: "Paga dhe sigurime", description: "Kosto e personelit" },
  { code: "UTILITETE", name: "Utilitete", description: "Energji, ujë, internet, telefoni" },
  { code: "PAKETIM", name: "Materiale paketimi", description: "Kuti, shirita, etiketa" },
  { code: "DOGANE", name: "Taksa doganore", description: "Tarifa dhe taksa doganore" },
  { code: "TRANSPORT", name: "Transport i tretë", description: "Subkontraktorë transporti" },
  { code: "MARKETING", name: "Marketing", description: "Reklama dhe promocione" },
  { code: "ADMIN", name: "Shpenzime administrative", description: "Kancelari, konsulencë, të tjera" },
  { code: "ARKETIME_COD", name: "Arkëtime COD", description: "Arkëtime nga dërgesat me pagesë në dorëzim" },
];

const SUPPLIERS = [
  { name: "Kastrati sh.a.", nipt: "K21711502V", phone: "+355 4 227 0000" },
  { name: "Servis Auto Tirana shpk", nipt: "L41903024K", phone: "+355 69 200 1122" },
  { name: "OSHEE sh.a.", nipt: "K72410014H" },
  { name: "Vodafone Albania sh.a.", nipt: "K11715005L" },
  { name: "PackPro shpk", nipt: "L82318451M", email: "shitje@packpro.al" },
];

const USERS = [
  { email: ADMIN_EMAIL, name: "Administrator", role: "ADMIN" as const, password: ADMIN_PASSWORD },
  { email: "financa@intexcourier.al", name: "Përgjegjës Financë", role: "FINANCE" as const, password: "Financa2026!" },
  { email: "arjan.hoxha@intexcourier.al", name: "Arjan Hoxha", role: "STAFF" as const, password: "Staf2026!" },
  { email: "elona.brahimi@intexcourier.al", name: "Elona Brahimi", role: "STAFF" as const, password: "Staf2026!" },
];

const BANK_ACCOUNTS = [
  { name: "BKT — Lek", currency: "ALL" as Currency, openingBalance: 1_250_000 },
  { name: "Raiffeisen — Euro", currency: "EUR" as Currency, openingBalance: 18_500 },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Numëruesit e referencave, një për çdo lloj. */
const counters: Partial<Record<TransactionType, number>> = {};
function nextReference(type: TransactionType, year: number): string {
  counters[type] = (counters[type] ?? 0) + 1;
  return `${TYPE_PREFIX[type]}-${year}-${String(counters[type]).padStart(4, "0")}`;
}

async function main() {
  console.log("→ Po krijohen përdoruesit dhe arkat e tyre…");

  const userIds: Record<string, string> = {};
  for (const user of USERS) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: await bcrypt.hash(user.password, 12),
      },
    });
    userIds[user.email] = record.id;

    // Çdo punonjës ka një arkë për çdo monedhë.
    for (const currency of CURRENCIES) {
      await prisma.account.upsert({
        where: {
          ownerId_kind_currency: { ownerId: record.id, kind: "ARKE", currency },
        },
        update: {},
        create: {
          kind: "ARKE",
          currency,
          name: `Arka në ${CURRENCY_LABELS[currency]}`,
          ownerId: record.id,
        },
      });
    }
    console.log(`   ${user.role.padEnd(8)} ${user.email} — 3 arka`);
  }

  console.log("→ Po krijohen llogaritë bankare…");
  for (const bank of BANK_ACCOUNTS) {
    const existing = await prisma.account.findFirst({
      where: { kind: "BANKE", name: bank.name },
    });
    if (!existing) {
      await prisma.account.create({
        data: {
          kind: "BANKE",
          currency: bank.currency,
          name: bank.name,
          openingBalance: new Prisma.Decimal(bank.openingBalance),
        },
      });
    }
  }

  console.log("→ Po krijohen kategoritë…");
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { code: category.code },
      update: { name: category.name, description: category.description },
      create: category,
    });
  }

  console.log("→ Po krijohen furnitorët…");
  for (const supplier of SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { nipt: supplier.nipt },
      update: { name: supplier.name },
      create: supplier,
    });
  }

  if ((await prisma.transaction.count()) > 0) {
    console.log("→ Ka tashmë lëvizje — nuk shtohen shembuj.");
    return;
  }

  console.log("→ Po krijohen lëvizje shembull…");

  const categoryByCode = new Map(
    (await prisma.category.findMany({ select: { id: true, code: true } })).map(
      (c) => [c.code, c.id],
    ),
  );
  const supplierByName = new Map(
    (await prisma.supplier.findMany({ select: { id: true, name: true } })).map(
      (s) => [s.name, s.id],
    ),
  );
  const cashBox = async (email: string, currency: Currency) =>
    prisma.account.findFirstOrThrow({
      where: { ownerId: userIds[email], kind: "ARKE", currency },
    });
  const bankByName = async (name: string) =>
    prisma.account.findFirstOrThrow({ where: { kind: "BANKE", name } });

  const arjan = "arjan.hoxha@intexcourier.al";
  const elona = "elona.brahimi@intexcourier.al";
  const finance = userIds["financa@intexcourier.al"];
  const year = new Date().getFullYear();
  const dayAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(12, 0, 0, 0);
    return d;
  };

  type Sample = {
    type: TransactionType;
    email: string;
    currency: Currency;
    description: string;
    amount: number;
    vatRate?: number;
    categoryCode?: string;
    supplier?: string;
    daysAgo: number;
    toBank?: string;
    counterparty?: string;
  };

  const samples: Sample[] = [
    // Mbushjet e arkave nga arkëtimet e Intex Courier
    { type: "ARKETIM", email: arjan, currency: "ALL", description: "Arkëtime COD — rajoni Tiranë", amount: 485_000, categoryCode: "ARKETIME_COD", daysAgo: 20 },
    { type: "ARKETIM", email: arjan, currency: "ALL", description: "Arkëtime COD — rajoni Tiranë", amount: 392_500, categoryCode: "ARKETIME_COD", daysAgo: 10 },
    { type: "ARKETIM", email: elona, currency: "ALL", description: "Arkëtime COD — rajoni Durrës", amount: 268_400, categoryCode: "ARKETIME_COD", daysAgo: 14 },
    { type: "ARKETIM", email: elona, currency: "EUR", description: "Arkëtime dërgesa ndërkombëtare", amount: 3_150, categoryCode: "ARKETIME_COD", daysAgo: 12 },
    { type: "ARKETIM", email: arjan, currency: "USD", description: "Arkëtim dërgesë nga SHBA", amount: 780, categoryCode: "ARKETIME_COD", daysAgo: 9 },

    // Shpenzime në monedha të ndryshme
    { type: "SHPENZIM", email: arjan, currency: "ALL", description: "Karburant për furgonat e Tiranës", amount: 184_000, vatRate: 20, categoryCode: "KARBURANT", supplier: "Kastrati sh.a.", daysAgo: 18 },
    { type: "SHPENZIM", email: arjan, currency: "ALL", description: "Ndërrim gomash për 4 furgona", amount: 96_000, vatRate: 20, categoryCode: "MIREMBAJTJE", supplier: "Servis Auto Tirana shpk", daysAgo: 8 },
    { type: "SHPENZIM", email: elona, currency: "ALL", description: "Kuti karton dhe shirita paketimi", amount: 67_200, vatRate: 20, categoryCode: "PAKETIM", supplier: "PackPro shpk", daysAgo: 6 },
    { type: "SHPENZIM", email: elona, currency: "EUR", description: "Tarifa transporti ndërkombëtar", amount: 1_240, categoryCode: "TRANSPORT", daysAgo: 5 },
    { type: "SHPENZIM", email: arjan, currency: "USD", description: "Abonim software gjurmimi", amount: 249, categoryCode: "ADMIN", daysAgo: 4 },

    // Depozitim në bankë
    { type: "DEPOZITIM", email: arjan, currency: "ALL", description: "Derdhje e arkëtimeve në bankë", amount: 500_000, daysAgo: 7, toBank: "BKT — Lek" },

    // E drejtë për arkëtim
    { type: "E_DREJTE", email: elona, currency: "ALL", description: "Fatura klienti — dërgesa korporative", amount: 145_000, vatRate: 20, categoryCode: "ARKETIME_COD", daysAgo: 3, counterparty: "Alba Logistics shpk" },
  ];

  for (const s of samples) {
    const vatRate = s.vatRate ?? 0;
    const vatAmount = round2((s.amount * vatRate) / 100);
    const totalAmount = round2(s.amount + vatAmount);

    const account = s.type === "E_DREJTE" ? null : await cashBox(s.email, s.currency);
    const toAccount = s.toBank ? await bankByName(s.toBank) : null;

    // Efektet: arkëtimi shton, shpenzimi heq, depozitimi zhvendos arkë → bankë.
    let accountEffect = 0;
    let toAccountEffect = 0;
    if (s.type === "ARKETIM") accountEffect = totalAmount;
    if (s.type === "SHPENZIM") accountEffect = -totalAmount;
    if (s.type === "DEPOZITIM") {
      accountEffect = -totalAmount;
      toAccountEffect = totalAmount;
    }

    const record = await prisma.transaction.create({
      data: {
        reference: nextReference(s.type, year),
        type: s.type,
        source: s.type === "ARKETIM" ? "INTEX" : "MANUAL",
        date: dayAgo(s.daysAgo),
        description: s.description,
        counterparty: s.counterparty ?? null,
        currency: s.currency,
        amount: new Prisma.Decimal(s.amount),
        vatRate: new Prisma.Decimal(vatRate),
        vatAmount: new Prisma.Decimal(vatAmount),
        totalAmount: new Prisma.Decimal(totalAmount),
        accountId: account?.id ?? null,
        toAccountId: toAccount?.id ?? null,
        accountEffect: new Prisma.Decimal(accountEffect),
        toAccountEffect: new Prisma.Decimal(toAccountEffect),
        categoryId: s.categoryCode ? categoryByCode.get(s.categoryCode) ?? null : null,
        supplierId: s.supplier ? supplierByName.get(s.supplier) ?? null : null,
        createdById: userIds[s.email] ?? finance,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "TRANSACTION_CREATED",
        details: `Të dhëna fillestare — ${record.reference}`,
        userId: record.createdById,
        transactionId: record.id,
      },
    });
  }

  console.log(`→ U krijuan ${samples.length} lëvizje shembull.`);
  console.log("\n✓ Gati. Hyr me:");
  console.log(`   ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("✗ Gabim gjatë mbushjes së bazës:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
