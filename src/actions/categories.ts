"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/session";
import { categorySchema } from "@/lib/validation";
import type { FormState } from "@/actions/auth";

function collect(issues: { path: (string | number)[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

export async function saveCategoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole(["ADMIN", "FINANCE"]);
  const id = String(formData.get("id") ?? "");

  const parsed = categorySchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
  if (!parsed.success) return { fieldErrors: collect(parsed.error.issues) };

  try {
    if (id) {
      await prisma.category.update({ where: { id }, data: parsed.data });
    } else {
      await prisma.category.create({ data: parsed.data });
    }
    await prisma.auditLog.create({
      data: {
        action: id ? "CATEGORY_UPDATED" : "CATEGORY_CREATED",
        details: parsed.data.code,
        userId: user.id,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { fieldErrors: { code: "Ky kod është përdorur më parë." } };
    }
    return { error: (error as Error).message };
  }

  revalidatePath("/kategori");
  revalidatePath("/shpenzime");
  return { success: id ? "Kategoria u ruajt." : "Kategoria u krijua." };
}

export async function toggleCategoryAction(formData: FormData) {
  await requireRole(["ADMIN", "FINANCE"]);
  const id = String(formData.get("id") ?? "");
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return;
  await prisma.category.update({
    where: { id },
    data: { active: !category.active },
  });
  revalidatePath("/kategori");
}

export async function deleteCategoryAction(formData: FormData) {
  await requireRole(["ADMIN"]);
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const count = await prisma.transaction.count({ where: { categoryId: id } });
  if (count > 0) {
    // Kategoria është në përdorim — vetëm çaktivizohet.
    await prisma.category.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.category.delete({ where: { id } });
  }
  revalidatePath("/kategori");
}
