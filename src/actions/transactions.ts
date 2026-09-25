"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Prisma,
  type Account,
  type Currency,
  type TransactionType,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { canSeeAll, requireUser, type CurrentUser } from "@/lib/session";
import {
  TYPE_LABELS,
  TYPE_PREFIX,
  computeEffects,
  usesCategory,
  usesSupplier,
  usesTwoAccounts,
} from "@/lib/transactions";
import { cashBoxName } from "@/lib/accounts";
import {
  collectFieldErrors,
  computeTotals,
  transactionSchema,
} from "@/lib/validation";
import type { FormState } from "@/actions/auth";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Gjeneron referencën e radhës për llojin: SHP-2026-0001 */
async function nextReference(
  tx: Prisma.TransactionClient,
  type: TransactionType,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${TYPE_PREFIX[type]}-${year}-`;
  const last = await tx.transaction.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const lastNumber = last ? Number(last.reference.slice(prefix.length)) : 0;
  const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/** Arka e një punonjësi për një monedhë; krijohet nëse mungon. */
async function cashBoxFor(
  tx: Prisma.TransactionClient,
  ownerId: string,
  currency: Currency,
): Promise<Account> {
  return tx.account.upsert({
    where: { ownerId_kind_currency: { ownerId, kind: "ARKE", currency } },
    update: {},
    create: { kind: "ARKE", currency, name: cashBoxName(currency), ownerId },
  });
}

class InputError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

/**
 * Përcakton llogarinë burim dhe atë destinacion sipas llojit të lëvizjes.
 * Shpenzimi dhe arkëtimi shkojnë automatikisht te arka e punonjësit në
 * monedhën e zgjedhur — përdoruesi zgjedh monedhën, jo llogarinë.
 */
async function resolveAccounts(
  tx: Prisma.TransactionClient,
  user: CurrentUser,
  data: {
    type: TransactionType;
    currency: Currency;
    ownerId: string;
    accountKind: "ARKE" | "BANKE";
    bankAccountId?: string | null;
    toAccountId?: string | null;
  },
): Promise<{ account: Account | null; toAccount: Account | null }> {
  if (data.type === "E_DREJTE") {
    return { account: null, toAccount: null };
  }

  // Burimi
  let account: Account;
  if (data.type === "DEPOZITIM" || data.accountKind === "ARKE") {
    account = await cashBoxFor(tx, data.ownerId, data.currency);
  } else {
    if (!data.bankAccountId) {
      throw new InputError("Zgjidh llogarinë bankare.", "bankAccountId");
    }
    const bank = await tx.account.findUnique({ where: { id: data.bankAccountId } });
    if (!bank || bank.kind !== "BANKE") {
      throw new InputError("Llogaria bankare nuk u gjet.", "bankAccountId");
    }
    if (bank.currency !== data.currency) {
      throw new InputError(
        "Monedha e llogarisë bankare nuk përputhet me monedhën e lëvizjes.",
        "bankAccountId",
      );
    }
    account = bank;
  }

  // Destinacioni
  if (!usesTwoAccounts(data.type)) {
    return { account, toAccount: null };
  }
  if (!data.toAccountId) {
    throw new InputError("Zgjidh llogarinë ku shkon paraja.", "toAccountId");
  }
  const toAccount = await tx.account.findUnique({
    where: { id: data.toAccountId },
  });
  if (!toAccount) {
    throw new InputError("Llogaria e destinacionit nuk u gjet.", "toAccountId");
  }
  if (toAccount.id === account.id) {
    throw new InputError(
      "Burimi dhe destinacioni nuk mund të jenë e njëjta llogari.",
      "toAccountId",
    );
  }
  // Stafi mund të dërgojë para vetëm në bankë ose në arkat e veta —
  // jo në arkën e një kolegu.
  if (
    !canSeeAll(user.role) &&
    toAccount.kind === "ARKE" &&
    toAccount.ownerId !== user.id
  ) {
    throw new InputError(
      "Mund të dërgosh para vetëm në bankë ose në arkat e tua.",
      "toAccountId",
    );
  }
  if (toAccount.currency !== account.currency) {
    // Këmbimi valutor nuk mbështetet ende — të dyja llogaritë duhet
    // të jenë në të njëjtën monedhë.
    throw new InputError(
      "Të dyja llogaritë duhet të jenë në të njëjtën monedhë.",
      "toAccountId",
    );
  }
  return { account, toAccount };
}

/** Gjen kategorinë me emër ose e krijon — që hedhja të jetë e shpejtë. */
async function resolveCategory(
  tx: Prisma.TransactionClient,
  name: string | null | undefined,
): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const existing = await tx.category.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return existing.id;

  const code = trimmed
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20) || "KATEGORI";

  const created = await tx.category.create({
    data: {
      name: trimmed,
      // Kodi duhet unik; nëse përplaset, i shtojmë një prapashtesë.
      code: (await tx.category.findUnique({ where: { code } }))
        ? `${code.slice(0, 15)}_${Math.floor(Math.random() * 9999)}`
        : code,
    },
  });
  return created.id;
}

async function saveAttachments(transactionId: string, files: File[]) {
  const usable = files.filter((f) => f && f.size > 0);
  if (usable.length === 0) return;

  await mkdir(UPLOAD_DIR, { recursive: true });

  for (const file of usable) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Dokumenti "${file.name}" e kalon kufirin e 8 MB.`);
    }
    if (!ALLOWED_MIME.has(file.type)) {
      throw new Error(
        `Formati i "${file.name}" nuk lejohet. Prano vetëm PDF, JPG, PNG, WEBP.`,
      );
    }
    const ext = path.extname(file.name).slice(0, 10) || "";
    const fileName = `${randomUUID()}${ext}`;
    await writeFile(
      path.join(UPLOAD_DIR, fileName),
      Buffer.from(await file.arrayBuffer()),
    );
    await prisma.attachment.create({
      data: {
        transactionId,
        fileName,
        originalName: file.name.slice(0, 200),
        mimeType: file.type,
        size: file.size,
      },
    });
  }
}

/** Kush lejohet të prekë arkën e këtij punonjësi. */
function resolveOwner(user: CurrentUser, requested?: string | null): string {
  if (!requested || requested === user.id) return user.id;
  if (!canSeeAll(user.role)) {
    throw new InputError("Mund të hedhësh lëvizje vetëm në arkat e tua.", "ownerId");
  }
  return requested;
}

export async function createTransactionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = transactionSchema.safeParse({
    type: formData.get("type"),
    date: formData.get("date"),
    description: formData.get("description"),
    currency: formData.get("currency") ?? "ALL",
    amount: formData.get("amount"),
    vatRate: formData.get("vatRate") ?? 0,
    ownerId: formData.get("ownerId") || null,
    accountKind: formData.get("accountKind") ?? "ARKE",
    bankAccountId: formData.get("bankAccountId") || null,
    toAccountId: formData.get("toAccountId") || null,
    categoryName: formData.get("categoryName") || null,
    supplierId: formData.get("supplierId") || null,
    documentNumber: formData.get("documentNumber") || null,
    counterparty: formData.get("counterparty") || null,
    direction: formData.get("direction") ?? "MINUS",
    settlesId: formData.get("settlesId") || null,
    // Kutia "Vetëm për PASH": e shënuar do të thotë se gjendja NUK preket.
    affectsBalance: formData.get("vetemPash") !== "on",
    notes: formData.get("notes") || null,
  });

  if (!parsed.success) {
    return { fieldErrors: collectFieldErrors(parsed.error.issues) };
  }
  const data = parsed.data;
  const totals = computeTotals(data.amount, data.vatRate);

  let created: { id: string; reference: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      const ownerId = resolveOwner(user, data.ownerId);
      const { account, toAccount } = await resolveAccounts(tx, user, {
        type: data.type,
        currency: data.currency,
        ownerId,
        accountKind: data.accountKind,
        bankAccountId: data.bankAccountId,
        toAccountId: data.toAccountId,
      });

      const effects = computeEffects({
        type: data.type,
        total: totals.totalAmount,
        affectsBalance: data.affectsBalance,
        surplus: data.direction === "PLUS",
      });

      const categoryId = usesCategory(data.type)
        ? await resolveCategory(tx, data.categoryName)
        : null;

      // Arkëtimi mund të mbyllë një të drejtë për arkëtim të hapur.
      let settlesId: string | null = null;
      if (data.type === "ARKETIM" && data.settlesId) {
        const receivable = await tx.transaction.findUnique({
          where: { id: data.settlesId },
        });
        if (!receivable || receivable.type !== "E_DREJTE") {
          throw new InputError("E drejta për arkëtim nuk u gjet.", "settlesId");
        }
        if (receivable.settledAt) {
          throw new InputError("Kjo e drejtë është arkëtuar më parë.", "settlesId");
        }
        settlesId = receivable.id;
      }

      const record = await tx.transaction.create({
        data: {
          reference: await nextReference(tx, data.type),
          type: data.type,
          date: new Date(data.date),
          description: data.description,
          documentNumber: data.documentNumber || null,
          counterparty: data.counterparty || null,
          currency: data.currency,
          amount: new Prisma.Decimal(totals.amount),
          vatRate: new Prisma.Decimal(data.vatRate),
          vatAmount: new Prisma.Decimal(totals.vatAmount),
          totalAmount: new Prisma.Decimal(totals.totalAmount),
          accountId: account?.id ?? null,
          toAccountId: toAccount?.id ?? null,
          accountEffect: new Prisma.Decimal(effects.accountEffect),
          toAccountEffect: new Prisma.Decimal(effects.toAccountEffect),
          affectsBalance: data.affectsBalance,
          categoryId,
          supplierId: usesSupplier(data.type) ? data.supplierId || null : null,
          settlesId,
          notes: data.notes || null,
          createdById: user.id,
        },
      });

      if (settlesId) {
        await tx.transaction.update({
          where: { id: settlesId },
          data: { settledAt: record.date },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "TRANSACTION_CREATED",
          details: `${TYPE_LABELS[data.type]} — ${record.reference}`,
          userId: user.id,
          transactionId: record.id,
        },
      });

      return { id: record.id, reference: record.reference };
    });
  } catch (error) {
    if (error instanceof InputError) {
      return error.field
        ? { fieldErrors: { [error.field]: error.message } }
        : { error: error.message };
    }
    return { error: (error as Error).message };
  }

  try {
    await saveAttachments(created.id, formData.getAll("attachments") as File[]);
  } catch (error) {
    revalidatePath("/");
    return {
      error: `Lëvizja ${created.reference} u regjistrua, por dokumenti nuk u ruajt: ${
        (error as Error).message
      }`,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/levizjet");
  revalidatePath("/arka");

  if (formData.get("stay") === "1") {
    return { success: `${TYPE_LABELS[data.type]} ${created.reference} u regjistrua.` };
  }
  redirect(`/levizjet/${created.id}`);
}

export async function deleteTransactionAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { attachments: true, settledBy: { select: { id: true } } },
  });
  if (!transaction) redirect("/levizjet?gabim=nuk-u-gjet");

  const isOwnEntry = transaction.createdById === user.id;
  if (!isOwnEntry && !canSeeAll(user.role)) {
    redirect(`/levizjet/${id}?gabim=pa-akses`);
  }
  if (transaction.settledBy) {
    redirect(`/levizjet/${id}?gabim=e-arketuar`);
  }

  // Nëse ky arkëtim mbylli një të drejtë, e rihapim.
  if (transaction.settlesId) {
    await prisma.transaction.update({
      where: { id: transaction.settlesId },
      data: { settledAt: null },
    });
  }

  for (const att of transaction.attachments) {
    await unlink(path.join(UPLOAD_DIR, att.fileName)).catch(() => {});
  }
  await prisma.transaction.delete({ where: { id } });

  revalidatePath("/dashboard");
  revalidatePath("/levizjet");
  revalidatePath("/arka");
  redirect("/levizjet?mesazh=fshire");
}

export async function deleteAttachmentAction(formData: FormData) {
  const user = await requireUser();
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { transaction: { select: { id: true, createdById: true } } },
  });
  if (!attachment) return;

  const { transaction } = attachment;
  if (transaction.createdById !== user.id && !canSeeAll(user.role)) {
    redirect(`/levizjet/${transaction.id}?gabim=pa-akses`);
  }

  await unlink(path.join(UPLOAD_DIR, attachment.fileName)).catch(() => {});
  await prisma.attachment.delete({ where: { id: attachmentId } });
  revalidatePath(`/levizjet/${transaction.id}`);
}
