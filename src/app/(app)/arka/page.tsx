import Link from "next/link";
import type { Metadata } from "next";
import type { Currency } from "@prisma/client";
import { syncCashBoxesAction, toggleAccountAction } from "@/actions/accounts";
import { SubmitButton } from "@/components/SubmitButton";
import { prisma } from "@/lib/db";
import { canSeeAll, requireUser } from "@/lib/session";
import { getBalances } from "@/lib/accounts";
import { visibleAccountWhere } from "@/lib/scope";
import { formatMoney, toNumber } from "@/lib/format";
import { CURRENCIES, CURRENCY_LABELS } from "@/lib/transactions";
import { AccountForm } from "./BankAccountForm";

export const metadata: Metadata = { title: "Arkat" };

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requireUser();
  const { edit } = await searchParams;
  const seeAll = canSeeAll(user.role);

  const [cashRows, bankRows, editing] = await Promise.all([
    getBalances({ ...visibleAccountWhere(user), kind: "ARKE" }),
    seeAll ? getBalances({ kind: "BANKE" }) : Promise.resolve([]),
    edit ? prisma.account.findUnique({ where: { id: edit } }) : null,
  ]);

  // Një rresht për punonjës, një kolonë për monedhë.
  const byOwner = new Map<
    string,
    { name: string; boxes: Partial<Record<Currency, { id: string; balance: number }>> }
  >();
  for (const row of cashRows) {
    const ownerId = row.account.ownerId;
    if (!ownerId) continue;
    const entry = byOwner.get(ownerId) ?? {
      name: row.account.owner?.name ?? "—",
      boxes: {},
    };
    entry.boxes[row.account.currency] = { id: row.account.id, balance: row.balance };
    byOwner.set(ownerId, entry);
  }
  const owners = [...byOwner.entries()].sort((a, b) =>
    a[1].name.localeCompare(b[1].name, "sq"),
  );

  const totals = CURRENCIES.map((currency) => ({
    currency,
    total: cashRows
      .filter((r) => r.account.currency === currency)
      .reduce((sum, r) => sum + r.balance, 0),
  }));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Arkat
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Çdo punonjës ka një arkë për çdo monedhë. Gjendja llogaritet nga
            gjendja e hapjes plus të gjitha lëvizjet e regjistruara.
          </p>
        </div>
        {seeAll ? (
          <form action={syncCashBoxesAction}>
            <SubmitButton className="btn-secondary" pendingLabel="Po krijohen…">
              Krijo arkat që mungojnë
            </SubmitButton>
          </form>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {totals.map((row) => (
          <div key={row.currency} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Totali i arkave · {CURRENCY_LABELS[row.currency]}
            </p>
            <p
              className={`mt-2 text-2xl font-semibold tracking-tight ${
                row.total < 0 ? "text-rose-600" : "text-slate-900"
              }`}
            >
              {formatMoney(row.total, row.currency)}
            </p>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">
            {seeAll ? `Arkat e punonjësve (${owners.length})` : "Arkat e mia"}
          </h2>
        </div>
        {owners.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            Nuk ka arka të krijuara ende.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Punonjësi</th>
                  {CURRENCIES.map((c) => (
                    <th key={c} className="text-right">
                      {CURRENCY_LABELS[c]}
                    </th>
                  ))}
                  {seeAll ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {owners.map(([ownerId, entry]) => (
                  <tr key={ownerId}>
                    <td className="font-medium text-slate-800">
                      {entry.name}
                      {ownerId === user.id ? (
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          (unë)
                        </span>
                      ) : null}
                    </td>
                    {CURRENCIES.map((c) => {
                      const box = entry.boxes[c];
                      return (
                        <td
                          key={c}
                          className={`text-right font-medium tabular-nums ${
                            (box?.balance ?? 0) < 0 ? "text-rose-600" : "text-slate-800"
                          }`}
                        >
                          {box ? formatMoney(box.balance, c) : "—"}
                        </td>
                      );
                    })}
                    {seeAll ? (
                      <td className="text-right">
                        <Link
                          href={`/levizjet?punonjesi=${ownerId}`}
                          className="btn-ghost text-xs"
                        >
                          Lëvizjet
                        </Link>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {seeAll ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="card h-fit">
            <div className="card-header">
              <h2 className="card-title">
                {editing ? `Ndrysho ${editing.name}` : "Llogari bankare e re"}
              </h2>
            </div>
            <AccountForm
              values={{
                id: editing?.id,
                kind: (editing?.kind ?? "BANKE") as "ARKE" | "BANKE",
                name: editing?.name ?? "",
                currency: editing?.currency ?? "ALL",
                openingBalance: editing
                  ? String(toNumber(editing.openingBalance))
                  : "0",
                active: editing?.active ?? true,
              }}
            />
          </section>

          <section className="card lg:col-span-2">
            <div className="card-header">
              <h2 className="card-title">Llogaritë bankare ({bankRows.length})</h2>
            </div>
            {bankRows.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">
                Ende nuk është krijuar asnjë llogari bankare.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Emri</th>
                      <th>Monedha</th>
                      <th className="text-right">Gjendja e hapjes</th>
                      <th className="text-right">Gjendja</th>
                      <th>Statusi</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {bankRows.map((row) => (
                      <tr key={row.account.id}>
                        <td className="font-medium text-slate-800">
                          {row.account.name}
                        </td>
                        <td>{CURRENCY_LABELS[row.account.currency]}</td>
                        <td className="text-right tabular-nums text-slate-600">
                          {formatMoney(
                            toNumber(row.account.openingBalance),
                            row.account.currency,
                          )}
                        </td>
                        <td className="text-right font-semibold tabular-nums">
                          {formatMoney(row.balance, row.account.currency)}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              row.account.active
                                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                                : "bg-slate-100 text-slate-600 ring-slate-200"
                            }`}
                          >
                            {row.account.active ? "Aktive" : "Çaktivizuar"}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <Link
                              href={`/arka?edit=${row.account.id}`}
                              className="btn-ghost text-xs"
                            >
                              Ndrysho
                            </Link>
                            <form action={toggleAccountAction}>
                              <input type="hidden" name="id" value={row.account.id} />
                              <SubmitButton className="btn-ghost text-xs">
                                {row.account.active ? "Çaktivizo" : "Aktivizo"}
                              </SubmitButton>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
