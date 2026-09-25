"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveAccountAction } from "@/actions/accounts";
import type { FormState } from "@/actions/auth";
import { Alert } from "@/components/Alert";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { CURRENCIES, CURRENCY_LABELS } from "@/lib/transactions";

type Values = {
  id?: string;
  kind: "ARKE" | "BANKE";
  name: string;
  currency: string;
  openingBalance: string;
  active: boolean;
};

export function AccountForm({ values }: { values: Values }) {
  const [state, formAction] = useActionState(saveAccountAction, {} as FormState);
  const editing = Boolean(values.id);

  return (
    <form action={formAction} className="space-y-4 p-5" key={values.id ?? "new"}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <input type="hidden" name="kind" value={values.kind} />
      {state.error ? <Alert kind="error">{state.error}</Alert> : null}
      {state.success ? <Alert kind="success">{state.success}</Alert> : null}

      <Field label="Emri i llogarisë" htmlFor="name" required error={state.fieldErrors?.name}>
        <input
          id="name"
          name="name"
          required
          defaultValue={values.name}
          className="input"
          placeholder="p.sh. BKT — Lek"
        />
      </Field>

      <Field label="Monedha" htmlFor="currency" required error={state.fieldErrors?.currency}>
        <select
          id="currency"
          name="currency"
          defaultValue={values.currency}
          className="input"
          disabled={editing}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {CURRENCY_LABELS[c]}
            </option>
          ))}
        </select>
        {editing ? (
          <input type="hidden" name="currency" value={values.currency} />
        ) : null}
      </Field>

      <Field
        label="Gjendja e hapjes"
        htmlFor="openingBalance"
        hint="Sa para kishte llogaria kur hyri në sistem."
        error={state.fieldErrors?.openingBalance}
      >
        <input
          id="openingBalance"
          name="openingBalance"
          inputMode="decimal"
          defaultValue={values.openingBalance}
          className="input text-right tabular-nums"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values.active}
          className="h-4 w-4 rounded border-slate-300 text-brand-600"
        />
        Aktive
      </label>

      <div className="flex gap-2">
        <SubmitButton className="btn-primary" pendingLabel="Po ruhet…">
          {editing ? "Ruaj ndryshimet" : "Krijo llogarinë"}
        </SubmitButton>
        {editing ? (
          <Link href="/arka" className="btn-secondary">
            Anulo
          </Link>
        ) : null}
      </div>
    </form>
  );
}
