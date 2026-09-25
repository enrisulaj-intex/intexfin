"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createUserAction, updateUserAction } from "@/actions/users";
import type { FormState } from "@/actions/auth";
import { Alert } from "@/components/Alert";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { ROLE_LABELS } from "@/lib/format";

function RoleSelect({
  defaultValue,
  error,
}: {
  defaultValue: string;
  error?: string;
}) {
  return (
    <Field label="Roli" htmlFor="role" required error={error}>
      <select id="role" name="role" defaultValue={defaultValue} className="input">
        {Object.entries(ROLE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CreateUserForm() {
  const [state, formAction] = useActionState(createUserAction, {} as FormState);

  return (
    <form action={formAction} className="space-y-4 p-5">
      {state.error ? <Alert kind="error">{state.error}</Alert> : null}
      {state.success ? <Alert kind="success">{state.success}</Alert> : null}

      <Field label="Emri i plotë" htmlFor="name" required error={state.fieldErrors?.name}>
        <input id="name" name="name" required className="input" placeholder="Enri Sulaj" />
      </Field>

      <Field label="Email" htmlFor="email" required error={state.fieldErrors?.email}>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="input"
          placeholder="emri@intexcourier.al"
        />
      </Field>

      <RoleSelect defaultValue="STAFF" error={state.fieldErrors?.role} />

      <Field
        label="Fjalëkalimi fillestar"
        htmlFor="password"
        required
        hint="Minimumi 8 karaktere. Përdoruesi duhet ta ndryshojë pas hyrjes së parë."
        error={state.fieldErrors?.password}
      >
        <input
          id="password"
          name="password"
          type="text"
          required
          minLength={8}
          className="input"
        />
      </Field>

      <SubmitButton className="btn-primary" pendingLabel="Po krijohet…">
        Krijo përdoruesin
      </SubmitButton>
    </form>
  );
}

type EditValues = {
  id: string;
  name: string;
  role: string;
  active: boolean;
};

export function EditUserForm({ values }: { values: EditValues }) {
  const [state, formAction] = useActionState(updateUserAction, {} as FormState);

  return (
    <form action={formAction} className="space-y-4 p-5" key={values.id}>
      <input type="hidden" name="id" value={values.id} />
      {state.error ? <Alert kind="error">{state.error}</Alert> : null}
      {state.success ? <Alert kind="success">{state.success}</Alert> : null}

      <Field label="Emri i plotë" htmlFor="name" required error={state.fieldErrors?.name}>
        <input
          id="name"
          name="name"
          required
          defaultValue={values.name}
          className="input"
        />
      </Field>

      <RoleSelect defaultValue={values.role} error={state.fieldErrors?.role} />

      <Field
        label="Fjalëkalim i re"
        htmlFor="password"
        hint="Lëre bosh për të mos e ndryshuar."
        error={state.fieldErrors?.password}
      >
        <input id="password" name="password" type="text" className="input" />
      </Field>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="active"
          defaultChecked={values.active}
          className="h-4 w-4 rounded border-slate-300 text-brand-600"
        />
        Llogari aktive
      </label>

      <div className="flex gap-2">
        <SubmitButton className="btn-primary" pendingLabel="Po ruhet…">
          Ruaj ndryshimet
        </SubmitButton>
        <Link href="/perdorues" className="btn-secondary">
          Anulo
        </Link>
      </div>
    </form>
  );
}
