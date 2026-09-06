import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, adminUsers, type AdminUserRow } from "@/server/db";
import { hashPassword, verifyPassword } from "./password";

/**
 * Sessions and the authorization guard for the admin panel.
 *
 * Deliberately dependency-free — HMAC ships in Node's standard library, and the
 * password half lives in `./password.ts` (split out so the CLI can import it
 * without tripping `server-only`). The trade-off is that password reset
 * e-mails, social login and MFA are not here; if any becomes a requirement,
 * this is the file to replace with Auth.js, and everything above it keeps
 * working because callers only ever touch `getSession` / `requireAdmin`.
 */

export { hashPassword, verifyPassword };

/* -------------------------------------------------------------------------- */
/* Sessions                                                                    */
/* -------------------------------------------------------------------------- */

const COOKIE_NAME = "ayyan_admin";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * A stateless signed cookie rather than a sessions table: there is no "log out
 * everywhere" requirement, and a table would add a database round trip to every
 * admin request for a panel with a handful of users. The cost is that a stolen
 * cookie stays valid until it expires — hence the 12-hour lifetime rather than
 * the usual 30 days, and `isActive` being re-checked from the database on every
 * request in `getSession`, so deactivating an account takes effect immediately.
 */
function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "ADMIN_SESSION_SECRET is missing or too short (needs >= 32 characters). " +
        "Generate one with:  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return secret;
}

interface SessionPayload {
  userId: string;
  /** Unix seconds. */
  exp: number;
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  // Compare the signature in constant time, and only then trust the body.
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof payload.userId !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const store = await cookies();

  store.set(COOKIE_NAME, encodeSession({ userId, exp }), {
    httpOnly: true,
    // Off over plain HTTP or the cookie is silently dropped in local dev.
    secure: process.env.NODE_ENV === "production",
    // "lax" not "strict": "strict" would drop the cookie on the redirect back
    // from an external link into /admin, showing a spurious login screen.
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/* -------------------------------------------------------------------------- */
/* The guard                                                                   */
/* -------------------------------------------------------------------------- */

/** What a page or action is allowed to know about the signed-in user. */
export interface AdminSession {
  id: string;
  name: string;
  email: string;
  role: "owner" | "editor";
}

function toSession(row: AdminUserRow): AdminSession {
  // Explicit field list, never the whole row: `passwordHash` must not be one
  // prop-spread away from reaching a Client Component.
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

/**
 * The signed-in user, or null.
 *
 * `cache()` de-duplicates within a single request, so a layout, a page and three
 * components can each ask independently without five database round trips —
 * while still re-reading on the next request, which is what makes deactivation
 * immediate.
 */
export const getSession = cache(async (): Promise<AdminSession | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = decodeSession(token);
  if (!payload) return null;

  const [user] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, payload.userId))
    .limit(1);

  // A valid signature over a deleted or suspended account is still not a login.
  if (!user || !user.isActive) return null;

  return toSession(user);
});

/**
 * Assert an authenticated admin, or throw.
 *
 * Every Server Action must call this. Next's own docs are explicit that actions
 * are reachable by direct POST, not only through the form that renders them, so
 * gating the *route* in `proxy.ts` protects the UI but not the mutation behind
 * it. This is the check that actually stops a write.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized — you are not signed in.");
  return session;
}

/**
 * The page-render counterpart to `requireAdmin`: redirects to login instead of
 * throwing.
 *
 * A layout and the page inside it render concurrently, so on a signed-out visit
 * the layout's redirect and the page's guard race. If the page throws, that
 * error is logged and can reach the error boundary before the redirect lands —
 * an operator whose session merely expired sees "Unauthorized" instead of a
 * login form. `redirect()` is cooperative: whichever fires first, the result is
 * the same navigation.
 *
 * Server Actions keep using `requireAdmin`, which throws — a direct POST to an
 * action id has no page to redirect to, and a mutation must fail loudly.
 */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** Same, but also demands the "owner" role — managing other staff accounts. */
export async function requireOwner(): Promise<AdminSession> {
  const session = await requireAdmin();
  if (session.role !== "owner") {
    throw new Error("Only an owner can manage admin accounts.");
  }
  return session;
}

/* -------------------------------------------------------------------------- */
/* Login                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Verifies credentials. Returns the user or null — never *why* it failed, so
 * the caller cannot accidentally leak whether an address has an account.
 */
export async function authenticate(
  email: string,
  password: string,
): Promise<AdminSession | null> {
  const [user] = await db
    .select()
    .from(adminUsers)
    .where(sql`lower(${adminUsers.email}) = lower(${email})`)
    .limit(1);

  if (!user || !user.isActive) {
    // Hash anyway. Returning early on an unknown address makes the response
    // measurably faster than a wrong password, which turns login into an
    // account-enumeration oracle.
    await hashPassword(password);
    return null;
  }

  if (!(await verifyPassword(password, user.passwordHash))) return null;

  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUsers.id, user.id));

  return toSession(user);
}
