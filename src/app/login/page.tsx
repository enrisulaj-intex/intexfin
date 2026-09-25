import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Hyrje" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white shadow-sm">
            IF
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            IntexFin
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sistemi financiar i Intex Courier
          </p>
        </div>

        <div className="card p-6">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Për problemet me hyrjen, kontakto administratorin e sistemit.
        </p>
      </div>
    </main>
  );
}
