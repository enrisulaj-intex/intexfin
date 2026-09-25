"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveSupplierAction } from "@/actions/suppliers";
import type { FormState } from "@/actions/auth";
import { Alert } from "@/components/Alert";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

type Values = {
  id?: string;
  name: string;
  nipt: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  active: boolean;
};

export function SupplierForm({ values }: { values: Values }) {
  const [state, formAction] = useActionState(saveSupplierAction, {} as FormState);
  const editing = Boolean(values.id);

  return (
    <form action={formAction} className="space-y-4 p-5" key={values.id ?? "new"}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {state.error ? <Alert kind="error">{state.error}</Alert> : null}
      {state.success ? <Alert kind="success">{state.success}</Alert> : null}

      <Field label="Emri" htmlFor="name" required error={state.fieldErrors?.name}>
        <input
          id="name"
          name="name"
          required
          defaultValue={values.name}
          className="input"
          placeholder="Kastrati sh.a."
        />
      </Field>

      <Field label="NIPT" htmlFor="nipt" error={state.fieldErrors?.nipt}>
        <input
          id="nipt"
          name="nipt"
          defaultValue={values.nipt}
          className="input uppercase"
          placeholder="K12345678L"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={values.email}
            className="input"
          />
        </Field>
        <Field label="Telefon" htmlFor="phone" error={state.fieldErrors?.phone}>
          <input
            id="phone"
            name="phone"
            defaultValue={values.phone}
            className="input"
            placeholder="+355 69 …"
          />
        </Field>
      </div>

      <Field label="Adresa" htmlFor="address" error={state.fieldErrors?.address}>
        <input
          id="address"
          name="address"
          defaultValue={values.address}
          className="input"
        />
      </Field>

      <Field label="Shënime" htmlFor="notes" error={state.fieldErrors?.notes}>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={values.notes}
          className="input resize-y"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values.active}
          className="h-4 w-4 rounded border-slate-300 text-brand-600"
        />
        Aktiv
      </label>

      <div className="flex gap-2">
        <SubmitButton className="btn-primary" pendingLabel="Po ruhet…">
          {editing ? "Ruaj ndryshimet" : "Krijo furnitorin"}
        </SubmitButton>
        {editing ? (
          <Link href="/furnitore" className="btn-secondary">
            Anulo
          </Link>
        ) : null}
      </div>
    </form>
  );
}
