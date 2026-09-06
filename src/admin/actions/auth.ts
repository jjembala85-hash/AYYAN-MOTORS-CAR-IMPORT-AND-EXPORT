"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { authenticate, createSession, destroySession } from "@/admin/auth";
import type { FormState } from "@/admin/schemas/vehicle";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your e-mail address."),
  password: z.string().min(1, "Enter your password."),
});

/**
 * Naive per-process throttle on failed logins.
 *
 * Honest about what it is: a speed bump, not a defence. It lives in memory, so
 * it resets on deploy and is per-instance — on several instances an attacker
 * gets the allowance times the instance count. It costs nothing and stops the
 * casual case; anything more serious belongs at the edge (Cloudflare, Vercel
 * WAF) where the request can be dropped before it reaches this process at all.
 */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function throttled(key: string): boolean {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now - record.first > WINDOW_MS) return false;
  return record.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now - record.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return;
  }
  record.count++;
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      errors: z.flattenError(parsed.error).fieldErrors,
      values: { email: String(formData.get("email") ?? "") },
    };
  }

  const { email, password } = parsed.data;
  const key = email.toLowerCase();

  if (throttled(key)) {
    return {
      ok: false,
      message: "Too many failed attempts. Wait 15 minutes and try again.",
      values: { email },
    };
  }

  const user = await authenticate(email, password);
  if (!user) {
    recordFailure(key);
    return {
      // One message for both a wrong address and a wrong password: telling them
      // apart confirms which addresses have accounts.
      message: "That e-mail and password don't match an account.",
      ok: false,
      values: { email },
    };
  }

  attempts.delete(key);
  await createSession(user.id);

  // Outside the try/catch shape on purpose — redirect() works by throwing, so
  // wrapping it in error handling would swallow the navigation.
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}
