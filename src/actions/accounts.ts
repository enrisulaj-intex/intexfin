"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ensureCashBoxes } from "@/lib/accounts";
import { accountSchema, collectFieldErrors } from "@/lib/validation";
import type { FormState } from "@/actions/auth";

/** Krijon ose ndryshon një llogari bankare, ose rregullon gjendjen e hapjes së një arke. */
export async function saveAccountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole(["ADMIN", "FINANCE"]);

  const parsed = accountSchema.safeParse({
    id: formData.get("id") || null,
    kind: formData.get("kind") ?? "BANKE",
    name: formData.get("name"),
    currency: formData.get("currency") ?? "ALL",
    ownerId: formData.get("ownerId") || null,
    openingBalance: formData.get("openingBalance") ?? 0,
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
  if (!parsed.success) return { fieldErrors: collectFieldErrors(parsed.error.issues) };

  const { id, kind, name, currency, ownerId, openingBalance, active } = parsed.data;

  try {
    if (id) {
      // Te llogaritë ekzistuese ndryshohen vetëm emri, gjendja e hapjes dhe statusi;
      // monedha dhe pronari mbeten të fiksuara që të mos prishen lëvizjet e kryera.
      await prisma.account.update({
        where: { id },
        data: {
          name,
          openingBalance: new Prisma.Decimal(openingBalance),
          active,
        },
      });
    } else {
      await prisma.account.create({
        data: {
          kind,
          currency,
          name,
          ownerId: kind === "ARKE" ? ownerId : null,
          openingBalance: new Prisma.Decimal(openingBalance),
          active,
        },
      });
    }
    await prisma.auditLog.create({
      data: {
        action: id ? "ACCOUNT_UPDATED" : "ACCOUNT_CREATED",
        details: name,
        userId: admin.id,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Ky punonjës e ka tashmë një arkë në këtë monedhë." };
    }
    return { error: (error as Error).message };
  }

  revalidatePath("/arka");
  revalidatePath("/dashboard");
  return { success: id ? "Llogaria u ruajt." : "Llogaria u krijua." };
}

/** Rikrijon arkat që mungojnë për të gjithë punonjësit aktivë. */
export async function syncCashBoxesAction() {
  const admin = await requireRole(["ADMIN", "FINANCE"]);
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true },
  });
  for (const user of users) {
    await ensureCashBoxes(user.id);
  }
  await prisma.auditLog.create({
    data: { action: "CASHBOXES_SYNCED", userId: admin.id },
  });
  revalidatePath("/arka");
}

export async function toggleAccountAction(formData: FormData) {
  await requireRole(["ADMIN", "FINANCE"]);
  const id = String(formData.get("id") ?? "");
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return;
  await prisma.account.update({
    where: { id },
    data: { active: !account.active },
  });
  revalidatePath("/arka");
}
