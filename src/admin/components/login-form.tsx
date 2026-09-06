"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LogIn } from "lucide-react";
import { login } from "@/admin/actions/auth";
import type { FormState } from "@/admin/schemas/vehicle";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function SubmitButton() {
  // `useFormStatus` has to be read from a child of the <form>, not from the
  // component that renders it — hence the separate component.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <LogIn aria-hidden className="size-4" />
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<FormState, FormData>(login, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? (
        <p
          role="alert"
          className="rounded-md border border-brand/40 bg-brand/5 px-3 py-2 text-sm text-brand"
        >
          {state.message}
        </p>
      ) : null}

      <Field label="E-mail" htmlFor="email" error={state.errors?.email?.[0]}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          defaultValue={state.values?.email}
          invalid={Boolean(state.errors?.email)}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={state.errors?.password?.[0]}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(state.errors?.password)}
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
