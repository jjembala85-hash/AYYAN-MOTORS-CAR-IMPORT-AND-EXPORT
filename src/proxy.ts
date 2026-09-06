import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route gating for the admin panel.
 *
 * In Next 16 this file is `proxy.ts` — what earlier versions called
 * `middleware.ts`. Same behaviour, new name.
 *
 * This is an **optimistic check only**, which is what the Next docs recommend
 * proxy be used for: it looks for the presence of a session cookie and nothing
 * else. It does not verify the signature, does not read the database, and does
 * not know whether the account still exists. Doing any of that here would put a
 * database round trip in front of every asset request, and proxy is explicitly
 * not intended as an authorization solution.
 *
 * The real checks are:
 *   - `src/app/admin/layout.tsx`  — verifies the session before rendering
 *   - `requireAdmin()` in every Server Action — verifies before writing
 *
 * All this buys is that a signed-out visitor gets a login screen instead of a
 * thrown error. Forging the cookie gets you exactly as far as the layout.
 */

const COOKIE_NAME = "ayyan_admin";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(request.cookies.get(COOKIE_NAME)?.value);

  // Already signed in and heading for the login page — send them onward rather
  // than showing a form they don't need.
  if (pathname === "/admin/login") {
    if (hasCookie) return NextResponse.redirect(new URL("/admin", request.url));
    return NextResponse.next();
  }

  if (!hasCookie) {
    const login = new URL("/admin/login", request.url);
    // Remember where they were going so login can return them there. Only the
    // path and query, never an absolute URL from the request — accepting one of
    // those would make this an open redirect.
    login.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  // Everything under /admin except the login page's own assets. The public site
  // is untouched — no cookie parsing, no redirect logic, no added latency.
  matcher: ["/admin/:path*"],
};
