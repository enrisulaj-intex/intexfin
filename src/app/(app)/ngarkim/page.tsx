import Link from "next/link";
import type { Metadata } from "next";
import type { TransactionType } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { getEntryFormData } from "@/lib/entry-data";
import { toDateInputValue } from "@/lib/format";
import { TRANSACTION_TYPES, TYPE_LABELS, TYPE_SHORT_LABELS } from "@/lib/transactions";
import { ManualForm } from "./ManualForm";
import { ImportBox } from "./ImportBox";

export const metadata: Metadata = { title: "Ngarkim" };

const DESCRIPTIONS: Record<TransactionType, string> = {
  SHPENZIM: "Dalje parash nga arka e një punonjësi ose nga banka.",
  ARKETIM: "Hyrje parash — mbushja e arkës nga arkëtimet.",
  DEPOZITIM: "Derdhje e parave nga arka e punonjësit në llogarinë bankare.",
  E_DREJTE: "Shuma që pritet të arkëtohet. Nuk e prek gjendjen derisa arkëtohet.",
  DIFERENCE: "Korrigjim i gjendjes kur numërimi nuk përputhet me sistemin.",
  TRANSFERTE: "Lëvizje midis dy llogarive të së njëjtës monedhë.",
};

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ lloji?: string }>;
}) {
  const user = await requireUser();
  const { lloji } = await searchParams;

  const type =
    (TRANSACTION_TYPES.find((t) => t === lloji) as TransactionType | undefined) ??
    "SHPENZIM";

  const data = await getEntryFormData(user);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Ngarkim lëvizjesh
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Hidh një lëvizje me dorë ose ngarko shumë njëherësh nga Excel.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TRANSACTION_TYPES.map((t) => (
          <Link
            key={t}
            href={`/ngarkim?lloji=${t}`}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              t === type
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {TYPE_SHORT_LABELS[t]}
          </Link>
        ))}
      </nav>

      <p className="text-sm text-slate-500">{DESCRIPTIONS[type]}</p>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Hedhje manuale — {TYPE_LABELS[type]}</h2>
        </div>
        <ManualForm
          key={type}
          type={type}
          today={toDateInputValue(new Date())}
          currentUserId={user.id}
          {...data}
        />
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Ngarkim nga Excel — {TYPE_LABELS[type]}</h2>
        </div>
        <ImportBox key={type} type={type} />
      </section>
    </>
  );
}
