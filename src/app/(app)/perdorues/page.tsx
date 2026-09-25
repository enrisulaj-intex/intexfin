import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { ROLE_LABELS, formatDateTime } from "@/lib/format";
import { CreateUserForm, EditUserForm } from "./UserForms";

export const metadata: Metadata = { title: "Përdorues" };

const ROLE_STYLES: Record<string, string> = {
  ADMIN: "bg-brand-50 text-brand-800 ring-brand-200",
  FINANCE: "bg-sky-50 text-sky-800 ring-sky-200",
  STAFF: "bg-slate-100 text-slate-700 ring-slate-200",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const admin = await requireRole(["ADMIN"]);
  const { edit } = await searchParams;

  const [users, editing] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { transactions: true } } },
    }),
    edit ? prisma.user.findUnique({ where: { id: edit } }) : null,
  ]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Përdorues
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Administratori krijon llogaritë dhe përcakton rolet.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card h-fit">
          <div className="card-header">
            <h2 className="card-title">
              {editing ? `Ndrysho ${editing.name}` : "Përdorues i re"}
            </h2>
          </div>
          {editing ? (
            <EditUserForm
              values={{
                id: editing.id,
                name: editing.name,
                role: editing.role,
                active: editing.active,
              }}
            />
          ) : (
            <CreateUserForm />
          )}
        </section>

        <section className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">Lista ({users.length})</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Emri</th>
                  <th>Email</th>
                  <th>Roli</th>
                  <th className="text-right">Lëvizje</th>
                  <th>Krijuar</th>
                  <th>Statusi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium text-slate-800">
                      {user.name}
                      {user.id === admin.id ? (
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          (ti)
                        </span>
                      ) : null}
                    </td>
                    <td className="text-slate-600">{user.email}</td>
                    <td>
                      <span className={`badge ${ROLE_STYLES[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">
                      {user._count.transactions}
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          user.active
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                            : "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {user.active ? "Aktiv" : "Çaktivizuar"}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/perdorues?edit=${user.id}`}
                        className="btn-ghost text-xs"
                      >
                        Ndrysho
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
