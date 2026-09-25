import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth";

export async function setSessionCookie(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

/** Lexon sesionin dhe verifikon që përdoruesi është ende aktiv në bazën e të dhënave. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Kërkon një përdorues të loguar, përndryshe ridrejton në /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Kërkon një rol specifik, përndryshe ridrejton në dashboard. */
export async function requireRole(roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard?gabim=pa-akses");
  return user;
}

/** A mund ky rol të aprovojë/refuzojë/paguajë shpenzime? */
export function canApprove(role: Role): boolean {
  return role === "ADMIN" || role === "FINANCE";
}

/** A mund ky rol të shohë shpenzimet e të tjerëve? */
export function canSeeAllExpenses(role: Role): boolean {
  return role === "ADMIN" || role === "FINANCE";
}
