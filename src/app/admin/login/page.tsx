import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/admin/components/login-form";
import { getSession } from "@/admin/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Someone with a valid session who lands here directly gets sent on. proxy.ts
  // does this too, but only from the cookie's presence; this also covers an
  // expired or forged cookie, which should show the form rather than loop.
  if (await getSession()) redirect("/admin");

  return (
    <div className="grid min-h-dvh place-items-center bg-surface-sunken px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-[family-name:var(--font-archivo)] text-2xl font-extrabold tracking-tight">
            Ayyan <span className="text-brand">Admin</span>
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Sign in to manage the vehicle catalogue.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
