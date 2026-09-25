"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { supplierSchema } from "@/lib/validation";
import type { FormState } from "@/actions/auth";

function collect(issues: { path: (string | number)[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

export async function saveSupplierAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole(["ADMIN", "FINANCE"]);
  const id = String(formData.get("id") ?? "");

  const parsed = supplierSchema.safeParse({
    name: formData.get("name"),
    nipt: formData.get("nipt") || null,
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    address: formData.get("address") || null,
    notes: formData.get("notes") || null,
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
  if (!parsed.success) return { fieldErrors: collect(parsed.error.issues) };

  try {
    if (id) {
      await prisma.supplier.update({ where: { id }, data: parsed.data });
    } else {
      await prisma.supplier.create({ data: parsed.data });
    }
    await prisma.auditLog.create({
      data: {
        action: id ? "SUPPLIER_UPDATED" : "SUPPLIER_CREATED",
        details: parsed.data.name,
        userId: user.id,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { fieldErrors: { nipt: "Ky NIPT është regjistruar më parë." } };
    }
    return { error: (error as Error).message };
  }

  revalidatePath("/furnitore");
  revalidatePath("/shpenzime");
  return { success: id ? "Furnitori u ruajt." : "Furnitori u krijua." };
}

export async function toggleSupplierAction(formData: FormData) {
  await requireRole(["ADMIN", "FINANCE"]);
  const id = String(formData.get("id") ?? "");
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) return;
  await prisma.supplier.update({
    where: { id },
    data: { active: !supplier.active },
  });
  revalidatePath("/furnitore");
}
