import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, clearedSessionCookieOptions } from "@life/web-session";
import { apiBaseUrl } from "../../../../lib/config";

/**
 * Sign-out route handler (P1-032).
 *
 * Revokes the session server-side *and* clears the cookie. Both matter:
 * clearing only the cookie would leave a live, still-valid session row
 * behind, which is exactly the state ADR-0006 chose session records to
 * be able to end.
 *
 * The cookie is cleared even when the upstream revoke fails. A user who
 * pressed "выйти" must not be left holding a usable cookie because the
 * API was briefly unreachable -- the local half of signing out is the
 * half we can always honour.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const sessionId = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  if (sessionId) {
    await fetch(`${apiBaseUrl()}/api/v1/auth/sign-out`, {
      method: "POST",
      headers: { authorization: `Bearer ${sessionId}` },
      redirect: "manual",
    }).catch(() => null);
  }

  const response = NextResponse.json({ next: "/parent/sign-in" });
  response.cookies.set(
    SESSION_COOKIE_NAME,
    "",
    clearedSessionCookieOptions({ isDevelopment: process.env.NODE_ENV === "development" }),
  );
  return response;
}
