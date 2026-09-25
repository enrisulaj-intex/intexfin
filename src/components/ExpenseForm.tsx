"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { FormState } from "@/actions/auth";
import { Alert } from "@/components/Alert";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { formatMoney } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/format";

type Option = { id: string; name: string };

export type ExpenseFormValues = {
  id?: string;
  expenseDate: string;
  description: string;
  categoryId: string;
  supplierId: string;
  documentNumber: string;
  amount: string;
  vatRate: string;
  currency: string;
  paymentMethod: string;
  notes: string;
};

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  categories: Option[];
  suppliers: Option[];
  values: ExpenseFormValues;
  cancelHref: string;
};

function parseLocaleNumber(raw: string): number {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return 0;
  const normalized =
    s.includes(",") && s.includes(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function ExpenseForm({
  action,
  categories,
  suppliers,
  values,
  cancelHref,
}: Props) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const [amount, setAmount] = useState(values.amount);
  const [vatRate, setVatRate] = useState(values.vatRate);
  const [currency, setCurrency] = useState(values.currency);

  const totals = useMemo(() => {
    const net = parseLocaleNumber(amount);
    const rate = parseLocaleNumber(vatRate);
    const vat = Math.round(((net * rate) / 100) * 100) / 100;
    return { net, vat, total: Math.round((net + vat) * 100) / 100 };
  }, [amount, vatRate]);

  return (
    <form action={formAction} className="space-y-6">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {state.error ? <Alert kind="error">{state.error}</Alert> : null}

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Të dhënat e shpenzimit</h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field
            label="Data e shpenzimit"
            htmlFor="expenseDate"
            required
            error={state.fieldErrors?.expenseDate}
          >
            <input
              id="expenseDate"
              name="expenseDate"
              type="date"
              required
              defaultValue={values.expenseDate}
              className="input"
            />
          </Field>

          <Field
            label="Nr. i faturës / dokumentit"
            htmlFor="documentNumber"
            error={state.fieldErrors?.documentNumber}
          >
            <input
              id="documentNumber"
              name="documentNumber"
              defaultValue={values.documentNumber}
              className="input"
              placeholder="p.sh. 2026/145"
            />
          </Field>

          <Field
            label="Përshkrimi"
            htmlFor="description"
            required
            className="sm:col-span-2"
            error={state.fieldErrors?.description}
          >
            <input
              id="description"
              name="description"
              required
              defaultValue={values.description}
              className="input"
              placeholder="p.sh. Karburant për furgonat e Tiranës"
            />
          </Field>

          <Field
            label="Kategoria"
            htmlFor="categoryId"
            required
            error={state.fieldErrors?.categoryId}
          >
            <select
              id="categoryId"
              name="categoryId"
              required
              defaultValue={values.categoryId}
              className="input"
            >
              <option value="">— Zgjidh kategorinë —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Furnitori"
            htmlFor="supplierId"
            hint="Opsionale"
            error={state.fieldErrors?.supplierId}
          >
            <select
              id="supplierId"
              name="supplierId"
              defaultValue={values.supplierId}
              className="input"
            >
              <option value="">— Pa furnitor —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Vlera dhe pagesa</h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Vlera pa TVSH"
            htmlFor="amount"
            required
            error={state.fieldErrors?.amount}
          >
            <input
              id="amount"
              name="amount"
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input text-right tabular-nums"
              placeholder="0.00"
            />
          </Field>

          <Field label="TVSH %" htmlFor="vatRate" error={state.fieldErrors?.vatRate}>
            <select
              id="vatRate"
              name="vatRate"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className="input"
            >
              <option value="0">0% (pa TVSH)</option>
              <option value="6">6%</option>
              <option value="10">10%</option>
              <option value="20">20%</option>
            </select>
          </Field>

          <Field label="Monedha" htmlFor="currency" error={state.fieldErrors?.currency}>
            <select
              id="currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="input"
            >
              <option value="ALL">ALL — Lekë</option>
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — Dollar</option>
            </select>
          </Field>

          <Field
            label="Mënyra e pagesës"
            htmlFor="paymentMethod"
            error={state.fieldErrors?.paymentMethod}
          >
            <select
              id="paymentMethod"
              name="paymentMethod"
              defaultValue={values.paymentMethod}
              className="input"
            >
              {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <div className="sm:col-span-2 lg:col-span-4">
            <div className="flex flex-wrap items-center justify-end gap-6 rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-600">
                Pa TVSH:{" "}
                <strong className="tabular-nums text-slate-900">
                  {formatMoney(totals.net, currency)}
                </strong>
              </span>
              <span className="text-slate-600">
                TVSH:{" "}
                <strong className="tabular-nums text-slate-900">
                  {formatMoney(totals.vat, currency)}
                </strong>
              </span>
              <span className="text-slate-600">
                Totali:{" "}
                <strong className="text-base tabular-nums text-brand-700">
                  {formatMoney(totals.total, currency)}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Dokumente dhe shënime</h2>
        </div>
        <div className="grid gap-4 p-5">
          <Field
            label="Bashkëngjit dokumente"
            htmlFor="attachments"
            hint="PDF, JPG, PNG ose WEBP — maks. 8 MB për dokument."
          >
            <input
              id="attachments"
              name="attachments"
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="input file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
            />
          </Field>

          <Field label="Shënime" htmlFor="notes" error={state.fieldErrors?.notes}>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={values.notes}
              className="input resize-y"
              placeholder="Informacion shtesë për financën…"
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          name="intent"
          value="submit"
          className="btn-primary"
          pendingLabel="Po ruhet…"
        >
          Ruaj dhe dërgo për aprovim
        </SubmitButton>
        <SubmitButton
          name="intent"
          value="draft"
          className="btn-secondary"
          pendingLabel="Po ruhet…"
        >
          Ruaj si draft
        </SubmitButton>
        <Link href={cancelHref} className="btn-ghost">
          Anulo
        </Link>
      </div>
    </form>
  );
}
