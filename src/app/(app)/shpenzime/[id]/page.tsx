import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  changeExpenseStatusAction,
  deleteAttachmentAction,
  deleteExpenseAction,
} from "@/actions/expenses";
import { Alert } from "@/components/Alert";
import { RejectForm } from "@/components/RejectForm";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { prisma } from "@/lib/db";
import { canApprove, canSeeAllExpenses, requireUser } from "@/lib/session";
import {
  PAYMENT_LABELS,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
} from "@/lib/format";

export const metadata: Metadata = { title: "Detajet e shpenzimit" };

const AUDIT_LABELS: Record<string, string> = {
  EXPENSE_CREATED: "Krijuar",
  EXPENSE_UPDATED: "Ndryshuar",
  EXPENSE_SUBMITTED: "Dërguar për aprovim",
  EXPENSE_APPROVED: "Aprovuar",
  EXPENSE_REJECTED: "Refuzuar",
  EXPENSE_PAID: "Shënuar si paguar",
};

const ERROR_MESSAGES: Record<string, string> = {
  "pa-akses": "Nuk ke të drejta për këtë veprim.",
  status: "Veprimi nuk lejohet për statusin aktual të shpenzimit.",
  arsyeja: "Arsyeja e refuzimit është e detyrueshme.",
  veprim: "Veprim i panjohur.",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function ExpenseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gabim?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { gabim } = await searchParams;

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      category: true,
      supplier: true,
      createdBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { name: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!expense) notFound();
  if (!canSeeAllExpenses(user.role) && expense.createdById !== user.id) {
    notFound();
  }

  const isOwner = expense.createdById === user.id;
  const editable = expense.status === "DRAFT" || expense.status === "REJECTED";
  const canEdit = editable && (isOwner || canApprove(user.role));
  const canSubmit = editable && (isOwner || canApprove(user.role));
  const canDecide = expense.status === "SUBMITTED" && canApprove(user.role);
  const canPay = expense.status === "APPROVED" && canApprove(user.role);
  const canDelete =
    (isOwner && expense.status === "DRAFT") || user.role === "ADMIN";

  const details: { label: string; value: React.ReactNode }[] = [
    { label: "Data e shpenzimit", value: formatDate(expense.expenseDate) },
    { label: "Nr. dokumenti", value: expense.documentNumber || "—" },
    { label: "Kategoria", value: `${expense.category.name} (${expense.category.code})` },
    { label: "Furnitori", value: expense.supplier?.name ?? "—" },
    { label: "NIPT i furnitorit", value: expense.supplier?.nipt ?? "—" },
    { label: "Mënyra e pagesës", value: PAYMENT_LABELS[expense.paymentMethod] },
    { label: "Regjistruar nga", value: expense.createdBy.name },
    { label: "Krijuar më", value: formatDateTime(expense.createdAt) },
    { label: "Aprovuar nga", value: expense.approvedBy?.name ?? "—" },
    { label: "Aprovuar më", value: formatDateTime(expense.approvedAt) },
    { label: "Paguar më", value: formatDateTime(expense.paidAt) },
  ];

  return (
    <>
      <div>
        <Link
          href="/shpenzime"
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          ← Kthehu te shpenzimet
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {expense.reference}
          </h1>
          <StatusBadge status={expense.status} />
        </div>
        <p className="mt-1 text-sm text-slate-600">{expense.description}</p>
      </div>

      {gabim ? (
        <Alert kind="error">{ERROR_MESSAGES[gabim] ?? "Ndodhi një gabim."}</Alert>
      ) : null}

      {expense.status === "REJECTED" && expense.rejectReason ? (
        <Alert kind="error">
          <strong>Refuzuar:</strong> {expense.rejectReason}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <Link href={`/shpenzime/${expense.id}/ndrysho`} className="btn-secondary">
            Ndrysho
          </Link>
        ) : null}

        {canSubmit ? (
          <form action={changeExpenseStatusAction}>
            <input type="hidden" name="id" value={expense.id} />
            <input type="hidden" name="action" value="submit" />
            <SubmitButton className="btn-primary" pendingLabel="Po dërgohet…">
              Dërgo për aprovim
            </SubmitButton>
          </form>
        ) : null}

        {canDecide ? (
          <>
            <form action={changeExpenseStatusAction}>
              <input type="hidden" name="id" value={expense.id} />
              <input type="hidden" name="action" value="approve" />
              <SubmitButton className="btn-success" pendingLabel="Po aprovohet…">
                Aprovo
              </SubmitButton>
            </form>
            <RejectForm expenseId={expense.id} />
          </>
        ) : null}

        {canPay ? (
          <form action={changeExpenseStatusAction}>
            <input type="hidden" name="id" value={expense.id} />
            <input type="hidden" name="action" value="pay" />
            <SubmitButton className="btn-success" pendingLabel="Po regjistrohet…">
              Shëno si paguar
            </SubmitButton>
          </form>
        ) : null}

        {canDelete ? (
          <form action={deleteExpenseAction} className="ml-auto">
            <input type="hidden" name="id" value={expense.id} />
            <SubmitButton
              className="btn-ghost text-rose-600 hover:bg-rose-50"
              confirm={`Të fshihet përfundimisht shpenzimi ${expense.reference}?`}
              pendingLabel="Po fshihet…"
            >
              Fshi
            </SubmitButton>
          </form>
        ) : null}
      </div>

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
            {expense.notes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shënime
                </dt>
                <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-800">
                  {expense.notes}
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
              <span className="tabular-nums font-medium text-slate-900">
                {formatMoney(expense.amount, expense.currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-slate-600">
                TVSH ({formatNumber(expense.vatRate)}%)
              </span>
              <span className="tabular-nums font-medium text-slate-900">
                {formatMoney(expense.vatAmount, expense.currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-slate-200 pt-3">
              <span className="font-medium text-slate-700">Totali</span>
              <span className="text-lg font-semibold tabular-nums text-brand-700">
                {formatMoney(expense.totalAmount, expense.currency)}
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">
            Dokumente ({expense.attachments.length})
          </h2>
        </div>
        {expense.attachments.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            Nuk është bashkëngjitur asnjë dokument.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {expense.attachments.map((att) => (
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
                {canEdit || user.role === "ADMIN" ? (
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
        {expense.auditLogs.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">Nuk ka veprime të regjistruara.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {expense.auditLogs.map((log) => (
              <li key={log.id} className="flex flex-wrap gap-2 px-5 py-3 text-sm">
                <span className="font-medium text-slate-800">
                  {AUDIT_LABELS[log.action] ?? log.action}
                </span>
                <span className="text-slate-500">
                  nga {log.user?.name ?? "sistemi"} · {formatDateTime(log.createdAt)}
                </span>
                {log.details ? (
                  <span className="w-full text-xs text-slate-500">{log.details}</span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
