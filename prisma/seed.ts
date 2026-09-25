/**
 * Mbush bazën e të dhënave me të dhëna fillestare:
 * përdoruesit bazë, kategoritë tipike të një kompanie korriere,
 * disa furnitorë dhe shpenzime shembull.
 *
 * Ekzekuto: npm run db:seed
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@intexcourier.al";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Intex2026!";

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
];

const SUPPLIERS = [
  { name: "Kastrati sh.a.", nipt: "K21711502V", phone: "+355 4 227 0000" },
  { name: "Servis Auto Tirana shpk", nipt: "L41903024K", phone: "+355 69 200 1122" },
  { name: "OSHEE sh.a.", nipt: "K72410014H" },
  { name: "Vodafone Albania sh.a.", nipt: "K11715005L" },
  { name: "PackPro shpk", nipt: "L82318451M", email: "shitje@packpro.al" },
];

async function main() {
  console.log("→ Po krijohen përdoruesit…");

  const users = [
    {
      email: ADMIN_EMAIL,
      name: "Administrator",
      role: "ADMIN" as const,
      password: ADMIN_PASSWORD,
    },
    {
      email: "financa@intexcourier.al",
      name: "Përgjegjës Financë",
      role: "FINANCE" as const,
      password: "Financa2026!",
    },
    {
      email: "staf@intexcourier.al",
      name: "Operator Staf",
      role: "STAFF" as const,
      password: "Staf2026!",
    },
  ];

  const created: Record<string, string> = {};
  for (const user of users) {
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
    created[user.role] = record.id;
    console.log(`   ${user.role.padEnd(8)} ${user.email}`);
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

  const existingExpenses = await prisma.expense.count();
  if (existingExpenses > 0) {
    console.log(`→ Shpenzimet ekzistojnë (${existingExpenses}) — nuk shtohen shembuj.`);
    return;
  }

  console.log("→ Po krijohen shpenzime shembull…");
  const categoryMap = new Map(
    (await prisma.category.findMany({ select: { id: true, code: true } })).map(
      (c) => [c.code, c.id],
    ),
  );
  const supplierMap = new Map(
    (await prisma.supplier.findMany({ select: { id: true, name: true } })).map(
      (s) => [s.name, s.id],
    ),
  );

  const samples = [
    {
      code: "KARBURANT",
      supplier: "Kastrati sh.a.",
      description: "Karburant për flotën — java 1",
      amount: 184000,
      vatRate: 20,
      status: "PAID" as const,
      daysAgo: 24,
      paymentMethod: "BANK" as const,
      documentNumber: "2026/0451",
    },
    {
      code: "MIREMBAJTJE",
      supplier: "Servis Auto Tirana shpk",
      description: "Ndërrim gomash për 4 furgona",
      amount: 96000,
      vatRate: 20,
      status: "APPROVED" as const,
      daysAgo: 12,
      paymentMethod: "BANK" as const,
      documentNumber: "SA-1187",
    },
    {
      code: "UTILITETE",
      supplier: "OSHEE sh.a.",
      description: "Energji elektrike — magazina Tiranë",
      amount: 43500,
      vatRate: 20,
      status: "PAID" as const,
      daysAgo: 18,
      paymentMethod: "BANK" as const,
      documentNumber: "OSH-99231",
    },
    {
      code: "PAKETIM",
      supplier: "PackPro shpk",
      description: "Kuti karton dhe shirita paketimi",
      amount: 67200,
      vatRate: 20,
      status: "SUBMITTED" as const,
      daysAgo: 4,
      paymentMethod: "BANK" as const,
      documentNumber: "PP-2026-77",
    },
    {
      code: "ADMIN",
      supplier: null,
      description: "Kancelari për zyrën centrale",
      amount: 12800,
      vatRate: 20,
      status: "DRAFT" as const,
      daysAgo: 2,
      paymentMethod: "CASH" as const,
      documentNumber: null,
    },
    {
      code: "DOGANE",
      supplier: null,
      description: "Tarifa doganore për dërgesa ndërkombëtare",
      amount: 154000,
      vatRate: 0,
      status: "APPROVED" as const,
      daysAgo: 8,
      paymentMethod: "BANK" as const,
      documentNumber: "DOG-4412",
    },
  ];

  const year = new Date().getFullYear();
  let counter = 1;

  for (const sample of samples) {
    const categoryId = categoryMap.get(sample.code);
    if (!categoryId) continue;

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const vatAmount = round2((sample.amount * sample.vatRate) / 100);
    const totalAmount = round2(sample.amount + vatAmount);
    const expenseDate = new Date();
    expenseDate.setDate(expenseDate.getDate() - sample.daysAgo);

    const isDecided = sample.status === "APPROVED" || sample.status === "PAID";

    const expense = await prisma.expense.create({
      data: {
        reference: `SHP-${year}-${String(counter++).padStart(4, "0")}`,
        expenseDate,
        description: sample.description,
        documentNumber: sample.documentNumber,
        amount: new Prisma.Decimal(sample.amount),
        vatRate: new Prisma.Decimal(sample.vatRate),
        vatAmount: new Prisma.Decimal(vatAmount),
        totalAmount: new Prisma.Decimal(totalAmount),
        currency: "ALL",
        paymentMethod: sample.paymentMethod,
        status: sample.status,
        categoryId,
        supplierId: sample.supplier ? supplierMap.get(sample.supplier) ?? null : null,
        createdById: created.STAFF,
        approvedById: isDecided ? created.FINANCE : null,
        approvedAt: isDecided ? expenseDate : null,
        paidAt: sample.status === "PAID" ? expenseDate : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "EXPENSE_CREATED",
        details: `Të dhëna fillestare — ${expense.reference}`,
        userId: created.STAFF,
        expenseId: expense.id,
      },
    });
  }

  console.log(`→ U krijuan ${samples.length} shpenzime shembull.`);
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
