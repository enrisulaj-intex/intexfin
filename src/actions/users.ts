"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireRole } from "@/lib/session";
import { userCreateSchema, userUpdateSchema } from "@/lib/validation";
import type { FormState } from "@/actions/auth";

function collect(issues: { path: (string | number)[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

export async function createUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole(["ADMIN"]);

  const parsed = userCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: collect(parsed.error.issues) };

  try {
    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });
    await prisma.auditLog.create({
      data: {
        action: "USER_CREATED",
        details: created.email,
        userId: admin.id,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { fieldErrors: { email: "Ky email është regjistruar më parë." } };
    }
    return { error: (error as Error).message };
  }

  revalidatePath("/perdorues");
  return { success: "Përdoruesi u krijua." };
}

export async function updateUserAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole(["ADMIN"]);

  const parsed = userUpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    role: formData.get("role"),
    active: formData.get("active") === "on" || formData.get("active") === "true",
    password: formData.get("password") || undefined,
  });
  if (!parsed.success) return { fieldErrors: collect(parsed.error.issues) };

  const { id, name, role, active, password } = parsed.data;

  // Mbrojtje: administratori i fundit aktiv nuk mund të çaktivizohet ose degradohet.
  if (role !== "ADMIN" || !active) {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: "ADMIN", active: true, id: { not: id } },
    });
    if (otherActiveAdmins === 0) {
      return {
        error:
          "Duhet të mbetet të paktën një administrator aktiv në sistem.",
      };
    }
  }
  if (id === admin.id && !active) {
    return { error: "Nuk mund të çaktivizosh llogarinë tënde." };
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name,
        role,
        active,
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
      },
    });
    await prisma.auditLog.create({
      data: {
        action: password ? "USER_PASSWORD_RESET" : "USER_UPDATED",
        details: id,
        userId: admin.id,
      },
    });
  } catch (error) {
    return { error: (error as Error).message };
  }

  revalidatePath("/perdorues");
  return { success: "Përdoruesi u ruajt." };
}
