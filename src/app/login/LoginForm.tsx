"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/actions/auth";
import { Alert } from "@/components/Alert";
import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

const initialState: FormState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert kind="error">{state.error}</Alert> : null}

      <Field
        label="Email"
        htmlFor="email"
        required
        error={state.fieldErrors?.email}
      >
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="input"
          placeholder="emri@intexcourier.al"
        />
      </Field>

      <Field
        label="Fjalëkalimi"
        htmlFor="password"
        required
        error={state.fieldErrors?.password}
      >
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
          placeholder="••••••••"
        />
      </Field>

      <SubmitButton className="btn-primary w-full" pendingLabel="Po hyn…">
        Hyr në sistem
      </SubmitButton>
    </form>
  );
}
