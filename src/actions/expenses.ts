"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type ExpenseStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canApprove, requireUser } from "@/lib/session";
import { computeTotals, expenseSchema } from "@/lib/validation";
import type { FormState } from "@/actions/auth";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function fieldErrorsFrom(error: Prisma.PrismaClientKnownRequestError | Error) {
  return { error: error.message };
}

/** Gjeneron referencën e radhës: SHP-2026-0001 */
async function nextReference(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SHP-${year}-`;
  const last = await tx.expense.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const lastNumber = last ? Number(last.reference.slice(prefix.length)) : 0;
  const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function parseForm(formData: FormData) {
  return expenseSchema.safeParse({
    expenseDate: formData.get("expenseDate"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    supplierId: formData.get("supplierId") || null,
    documentNumber: formData.get("documentNumber") || null,
    amount: formData.get("amount"),
    vatRate: formData.get("vatRate") ?? 0,
    currency: formData.get("currency") ?? "ALL",
    paymentMethod: formData.get("paymentMethod") ?? "BANK",
    notes: formData.get("notes") || null,
  });
}

function collectFieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

async function saveAttachments(expenseId: string, files: File[]) {
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
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, fileName), buffer);
    await prisma.attachment.create({
      data: {
        expenseId,
        fileName,
        originalName: file.name.slice(0, 200),
        mimeType: file.type,
        size: file.size,
      },
    });
  }
}

export async function createExpenseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { fieldErrors: collectFieldErrors(parsed.error.issues) };
  }

  const data = parsed.data;
  const totals = computeTotals(data.amount, data.vatRate);
  const sendForApproval = formData.get("intent") === "submit";

  let expenseId: string;
  try {
    expenseId = await prisma.$transaction(async (tx) => {
      const reference = await nextReference(tx);
      const created = await tx.expense.create({
        data: {
          reference,
          expenseDate: new Date(data.expenseDate),
          description: data.description,
          categoryId: data.categoryId,
          supplierId: data.supplierId || null,
          documentNumber: data.documentNumber || null,
          amount: new Prisma.Decimal(totals.amount),
          vatRate: new Prisma.Decimal(data.vatRate),
          vatAmount: new Prisma.Decimal(totals.vatAmount),
          totalAmount: new Prisma.Decimal(totals.totalAmount),
          currency: data.currency,
          paymentMethod: data.paymentMethod,
          status: sendForApproval ? "SUBMITTED" : "DRAFT",
          notes: data.notes || null,
          createdById: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          action: sendForApproval ? "EXPENSE_SUBMITTED" : "EXPENSE_CREATED",
          details: `Referenca ${created.reference}`,
          userId: user.id,
          expenseId: created.id,
        },
      });
      return created.id;
    });
  } catch (error) {
    return fieldErrorsFrom(error as Error);
  }

  try {
    await saveAttachments(expenseId, formData.getAll("attachments") as File[]);
  } catch (error) {
    // Shpenzimi u krijua; raportojmë vetëm problemin e dokumenteve.
    revalidatePath("/shpenzime");
    return { error: (error as Error).message };
  }

  revalidatePath("/shpenzime");
  revalidatePath("/dashboard");
  redirect(`/shpenzime/${expenseId}`);
}

export async function updateExpenseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Shpenzimi nuk u identifikua." };

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return { error: "Shpenzimi nuk u gjet." };

  const isOwner = existing.createdById === user.id;
  const editable = existing.status === "DRAFT" || existing.status === "REJECTED";
  if (!editable) {
    return { error: "Vetëm shpenzimet në draft ose të refuzuara mund të ndryshohen." };
  }
  if (!isOwner && !canApprove(user.role)) {
    return { error: "Nuk ke të drejtë të ndryshosh këtë shpenzim." };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { fieldErrors: collectFieldErrors(parsed.error.issues) };
  }

  const data = parsed.data;
  const totals = computeTotals(data.amount, data.vatRate);
  const sendForApproval = formData.get("intent") === "submit";

  try {
    await prisma.expense.update({
      where: { id },
      data: {
        expenseDate: new Date(data.expenseDate),
        description: data.description,
        categoryId: data.categoryId,
        supplierId: data.supplierId || null,
        documentNumber: data.documentNumber || null,
        amount: new Prisma.Decimal(totals.amount),
        vatRate: new Prisma.Decimal(data.vatRate),
        vatAmount: new Prisma.Decimal(totals.vatAmount),
        totalAmount: new Prisma.Decimal(totals.totalAmount),
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        notes: data.notes || null,
        ...(sendForApproval
          ? { status: "SUBMITTED" as ExpenseStatus, rejectReason: null, rejectedAt: null }
          : {}),
      },
    });
    await prisma.auditLog.create({
      data: {
        action: sendForApproval ? "EXPENSE_SUBMITTED" : "EXPENSE_UPDATED",
        userId: user.id,
        expenseId: id,
      },
    });
  } catch (error) {
    return fieldErrorsFrom(error as Error);
  }

  try {
    await saveAttachments(id, formData.getAll("attachments") as File[]);
  } catch (error) {
    revalidatePath(`/shpenzime/${id}`);
    return { error: (error as Error).message };
  }

  revalidatePath("/shpenzime");
  revalidatePath(`/shpenzime/${id}`);
  revalidatePath("/dashboard");
  redirect(`/shpenzime/${id}`);
}

/** Kalon statusin e një shpenzimi. Aprovimi/refuzimi/pagesa kërkojnë rol financiar. */
export async function changeExpenseStatusAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  const reason = String(formData.get("rejectReason") ?? "").trim();

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) redirect("/shpenzime?gabim=nuk-u-gjet");

  const now = new Date();
  let data: Prisma.ExpenseUpdateInput;
  let auditAction: string;

  switch (action) {
    case "submit": {
      if (expense.createdById !== user.id && !canApprove(user.role)) {
        redirect(`/shpenzime/${id}?gabim=pa-akses`);
      }
      if (expense.status !== "DRAFT" && expense.status !== "REJECTED") {
        redirect(`/shpenzime/${id}?gabim=status`);
      }
      data = { status: "SUBMITTED", rejectReason: null, rejectedAt: null };
      auditAction = "EXPENSE_SUBMITTED";
      break;
    }
    case "approve": {
      if (!canApprove(user.role)) redirect(`/shpenzime/${id}?gabim=pa-akses`);
      if (expense.status !== "SUBMITTED") redirect(`/shpenzime/${id}?gabim=status`);
      data = {
        status: "APPROVED",
        approvedAt: now,
        approvedBy: { connect: { id: user.id } },
        rejectReason: null,
        rejectedAt: null,
      };
      auditAction = "EXPENSE_APPROVED";
      break;
    }
    case "reject": {
      if (!canApprove(user.role)) redirect(`/shpenzime/${id}?gabim=pa-akses`);
      if (expense.status !== "SUBMITTED") redirect(`/shpenzime/${id}?gabim=status`);
      if (!reason) redirect(`/shpenzime/${id}?gabim=arsyeja`);
      data = { status: "REJECTED", rejectedAt: now, rejectReason: reason.slice(0, 500) };
      auditAction = "EXPENSE_REJECTED";
      break;
    }
    case "pay": {
      if (!canApprove(user.role)) redirect(`/shpenzime/${id}?gabim=pa-akses`);
      if (expense.status !== "APPROVED") redirect(`/shpenzime/${id}?gabim=status`);
      data = { status: "PAID", paidAt: now };
      auditAction = "EXPENSE_PAID";
      break;
    }
    default:
      redirect(`/shpenzime/${id}?gabim=veprim`);
  }

  await prisma.expense.update({ where: { id }, data });
  await prisma.auditLog.create({
    data: {
      action: auditAction,
      details: reason || null,
      userId: user.id,
      expenseId: id,
    },
  });

  revalidatePath("/shpenzime");
  revalidatePath(`/shpenzime/${id}`);
  revalidatePath("/dashboard");
}

export async function deleteExpenseAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { attachments: true },
  });
  if (!expense) redirect("/shpenzime?gabim=nuk-u-gjet");

  const isOwnerDraft = expense.createdById === user.id && expense.status === "DRAFT";
  if (!isOwnerDraft && user.role !== "ADMIN") {
    redirect(`/shpenzime/${id}?gabim=pa-akses`);
  }

  for (const att of expense.attachments) {
    await unlink(path.join(UPLOAD_DIR, att.fileName)).catch(() => {});
  }
  await prisma.expense.delete({ where: { id } });

  revalidatePath("/shpenzime");
  revalidatePath("/dashboard");
  redirect("/shpenzime?mesazh=fshire");
}

export async function deleteAttachmentAction(formData: FormData) {
  const user = await requireUser();
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { expense: { select: { id: true, createdById: true, status: true } } },
  });
  if (!attachment) return;

  const { expense } = attachment;
  const editable = expense.status === "DRAFT" || expense.status === "REJECTED";
  const allowed =
    user.role === "ADMIN" || (editable && expense.createdById === user.id) ||
    (editable && canApprove(user.role));
  if (!allowed) redirect(`/shpenzime/${expense.id}?gabim=pa-akses`);

  await unlink(path.join(UPLOAD_DIR, attachment.fileName)).catch(() => {});
  await prisma.attachment.delete({ where: { id: attachmentId } });
  revalidatePath(`/shpenzime/${expense.id}`);
}
