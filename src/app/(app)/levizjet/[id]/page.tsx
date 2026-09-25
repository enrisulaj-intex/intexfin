import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  deleteAttachmentAction,
  deleteTransactionAction,
} from "@/actions/transactions";
import { Alert } from "@/components/Alert";
import { SubmitButton } from "@/components/SubmitButton";
import { prisma } from "@/lib/db";
import { canSeeAll, requireUser } from "@/lib/session";
import {
  SOURCE_LABELS,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatSigned,
  toNumber,
} from "@/lib/format";
import { CURRENCY_LABELS, TYPE_LABELS, TYPE_STYLES } from "@/lib/transactions";

export const metadata: Metadata = { title: "Detajet e lëvizjes" };

const ERROR_MESSAGES: Record<string, string> = {
  "pa-akses": "Nuk ke të drejta për këtë veprim.",
  "e-arketuar": "Kjo e drejtë është arkëtuar — fshi më parë arkëtimin përkatës.",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function TransactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gabim?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { gabim } = await searchParams;

  const t = await prisma.transaction.findUnique({
    where: { id },
    include: {
      category: true,
      supplier: true,
      account: { include: { owner: { select: { name: true } } } },
      toAccount: { include: { owner: { select: { name: true } } } },
      createdBy: { select: { id: true, name: true } },
      settles: { select: { id: true, reference: true, description: true } },
      settledBy: { select: { id: true, reference: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!t) notFound();

  const isVisible =
    canSeeAll(user.role) ||
    t.createdById === user.id ||
    t.account?.ownerId === user.id ||
    t.toAccount?.ownerId === user.id;
  if (!isVisible) notFound();

  const canDelete =
    (t.createdById === user.id || canSeeAll(user.role)) && !t.settledBy;

  const accountLabel = (a: typeof t.account) =>
    a
      ? a.kind === "ARKE"
        ? `${a.name} · ${a.owner?.name ?? "—"}`
        : `${a.name} (bankë)`
      : "—";

  const details: { label: string; value: React.ReactNode }[] = [
    { label: "Lloji", value: TYPE_LABELS[t.type] },
    { label: "Data", value: formatDate(t.date) },
    { label: "Monedha", value: CURRENCY_LABELS[t.currency] },
    { label: "Nga llogaria", value: accountLabel(t.account) },
    ...(t.toAccount
      ? [{ label: "Te llogaria", value: accountLabel(t.toAccount) }]
      : []),
    { label: "Kategoria", value: t.category?.name ?? "—" },
    ...(t.supplier ? [{ label: "Furnitori", value: t.supplier.name }] : []),
    { label: "Nr. dokumenti", value: t.documentNumber || "—" },
    { label: "Pala", value: t.counterparty || "—" },
    { label: "Regjistruar nga", value: t.createdBy.name },
    { label: "Burimi", value: SOURCE_LABELS[t.source] ?? t.source },
    { label: "Krijuar më", value: formatDateTime(t.createdAt) },
  ];

  return (
    <>
      <div>
        <Link
          href="/levizjet"
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          ← Kthehu te lëvizjet
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t.reference}
          </h1>
          <span className={`badge ${TYPE_STYLES[t.type]}`}>{TYPE_LABELS[t.type]}</span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{t.description}</p>
      </div>

      {gabim ? (
        <Alert kind="error">{ERROR_MESSAGES[gabim] ?? "Ndodhi një gabim."}</Alert>
      ) : null}

      {!t.affectsBalance ? (
        <Alert kind="info">
          Kjo lëvizje është shënuar <strong>vetëm për PASH</strong> — nuk e ka
          prekur gjendjen e arkës.
        </Alert>
      ) : null}

      {t.type === "E_DREJTE" ? (
        t.settledAt ? (
          <Alert kind="success">
            Arkëtuar më {formatDate(t.settledAt)}
            {t.settledBy ? (
              <>
                {" "}
                me{" "}
                <Link
                  href={`/levizjet/${t.settledBy.id}`}
                  className="font-medium underline"
                >
                  {t.settledBy.reference}
                </Link>
              </>
            ) : null}
            .
          </Alert>
        ) : (
          <Alert kind="warning">
            E drejtë e hapur — paraja nuk ka hyrë ende në arkë.
          </Alert>
        )
      ) : null}

      {t.settles ? (
        <Alert kind="info">
          Ky arkëtim mbyll të drejtën{" "}
          <Link href={`/levizjet/${t.settles.id}`} className="font-medium underline">
            {t.settles.reference}
          </Link>{" "}
          — {t.settles.description}
        </Alert>
      ) : null}

      {canDelete ? (
        <div className="flex">
          <form action={deleteTransactionAction} className="ml-auto">
            <input type="hidden" name="id" value={t.id} />
            <SubmitButton
              className="btn-ghost text-rose-600 hover:bg-rose-50"
              confirm={`Të fshihet lëvizja ${t.reference}? Gjendja e arkës do të rillogaritet.`}
              pendingLabel="Po fshihet…"
            >
              Fshi lëvizjen
            </SubmitButton>
          </form>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">Detajet</h2>
          </div>
          <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
            {details.map((row) => (
              <div key={row.label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {row.label}
                </dt>
                <dd className="mt-0.5 text-sm text-slate-800">{row.value}</dd>
              </div>
            ))}
            {t.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shënime
                </dt>
                <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-800">
                  {t.notes}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="card h-fit">
          <div className="card-header">
            <h2 className="card-title">Vlera</h2>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-slate-600">Pa TVSH</span>
              <span className="font-medium tabular-nums text-slate-900">
                {formatMoney(t.amount, t.currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-slate-600">
                TVSH ({formatNumber(t.vatRate)}%)
              </span>
              <span className="font-medium tabular-nums text-slate-900">
                {formatMoney(t.vatAmount, t.currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-slate-200 pt-3">
              <span className="font-medium text-slate-700">Totali</span>
              <span className="text-lg font-semibold tabular-nums text-brand-700">
                {formatMoney(t.totalAmount, t.currency)}
              </span>
            </div>
            <div className="space-y-1.5 border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Efekti në gjendje
              </p>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-slate-600">{accountLabel(t.account)}</span>
                <span
                  className={`font-semibold tabular-nums ${
                    toNumber(t.accountEffect) < 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {toNumber(t.accountEffect) === 0
                    ? "—"
                    : formatSigned(t.accountEffect, t.currency)}
                </span>
              </div>
              {t.toAccount ? (
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-slate-600">{accountLabel(t.toAccount)}</span>
                  <span className="font-semibold tabular-nums text-emerald-700">
                    {formatSigned(t.toAccountEffect, t.currency)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Dokumente ({t.attachments.length})</h2>
        </div>
        {t.attachments.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            Nuk është bashkëngjitur asnjë dokument.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {t.attachments.map((att) => (
              <li
                key={att.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <a
                    href={`/api/dokumente/${att.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    {att.originalName}
                  </a>
                  <span className="text-xs text-slate-500">
                    {formatSize(att.size)} · {formatDateTime(att.createdAt)}
                  </span>
                </div>
                {t.createdById === user.id || canSeeAll(user.role) ? (
                  <form action={deleteAttachmentAction}>
                    <input type="hidden" name="attachmentId" value={att.id} />
                    <SubmitButton
                      className="btn-ghost text-xs text-rose-600 hover:bg-rose-50"
                      confirm={`Të fshihet dokumenti "${att.originalName}"?`}
                    >
                      Fshi
                    </SubmitButton>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Historiku</h2>
        </div>
        <ol className="divide-y divide-slate-100">
          {t.auditLogs.map((log) => (
            <li key={log.id} className="flex flex-wrap gap-2 px-5 py-3 text-sm">
              <span className="font-medium text-slate-800">
                {log.details ?? log.action}
              </span>
              <span className="text-slate-500">
                nga {log.user?.name ?? "sistemi"} · {formatDateTime(log.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
