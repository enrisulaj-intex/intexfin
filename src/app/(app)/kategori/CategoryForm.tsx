"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveCategoryAction } from "@/actions/categories";
import type { FormState } from "@/actions/auth";
import { Alert } from "@/components/Alert";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

type Values = {
  id?: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
};

export function CategoryForm({ values }: { values: Values }) {
  const [state, formAction] = useActionState(saveCategoryAction, {} as FormState);
  const editing = Boolean(values.id);

  return (
    <form action={formAction} className="space-y-4 p-5" key={values.id ?? "new"}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      {state.error ? <Alert kind="error">{state.error}</Alert> : null}
      {state.success ? <Alert kind="success">{state.success}</Alert> : null}

      <Field label="Kodi" htmlFor="code" required error={state.fieldErrors?.code}>
        <input
          id="code"
          name="code"
          required
          defaultValue={values.code}
          className="input uppercase"
          placeholder="KARBURANT"
        />
      </Field>

      <Field label="Emri" htmlFor="name" required error={state.fieldErrors?.name}>
        <input
          id="name"
          name="name"
          required
          defaultValue={values.name}
          className="input"
          placeholder="Karburant"
        />
      </Field>

      <Field label="Përshkrimi" htmlFor="description" error={state.fieldErrors?.description}>
        <textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={values.description}
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
        Aktive
      </label>

      <div className="flex gap-2">
        <SubmitButton className="btn-primary" pendingLabel="Po ruhet…">
          {editing ? "Ruaj ndryshimet" : "Krijo kategorinë"}
        </SubmitButton>
        {editing ? (
          <Link href="/kategori" className="btn-secondary">
            Anulo
          </Link>
        ) : null}
      </div>
    </form>
  );
}
