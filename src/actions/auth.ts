"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Mesazh i njëjtë për email të gabuar dhe fjalëkalim të gabuar,
  // për të mos zbuluar se cilat email-e ekzistojnë.
  const invalid = { error: "Email ose fjalëkalim i gabuar." };

  if (!user || !user.active) return invalid;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return invalid;

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  await prisma.auditLog.create({
    data: { action: "USER_LOGIN", userId: user.id },
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
