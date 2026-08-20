import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@life/web-session";
import { apiBaseUrl } from "../../../../lib/config";

/**
 * Sign-in route handler (P1-032).
 *
 * This is the one place a session value is allowed to exist in the web
 * tier, and it exists only for the length of this function: the API's
 * response is read here, the session id is written into an httpOnly
 * cookie, and **it is never included in the response body**. The browser
 * gets a redirect target and nothing else.
 *
 * That is the whole point of the posture confirmed in
 * tasks/packets/P1-FRONTEND-web-app-pack.md. A child device is often a
 * shared device; an XSS on either surface must not be able to read a
 * session, so the value must never be reachable from client JavaScript.
 *
 * Note this route deliberately does *not* go through `@life/web-session`'s
 * proxy: the proxy attaches an existing session cookie, and sign-in is
 * the request that has no session yet.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { email?: string; password?: string; familyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Не получилось прочитать запрос." } }, { status: 400 });
  }

  const upstream = await fetch(`${apiBaseUrl()}/api/v1/auth/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // A 3xx must not be chased to another origin, same rule the proxy applies.
    redirect: "manual",
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      { error: { code: "NETWORK_ERROR", message: "Сервис недоступен. Попробуйте ещё раз." } },
      { status: 503 },
    );
  }

  if (!upstream.ok) {
    // Pass the API's own failure through unchanged. It is deliberately
    // undifferentiated (wrong password, unknown email, suspended account
    // and non-membership all look identical), and the web tier must not
    // "helpfully" narrow it down -- that would rebuild the account
    // enumeration oracle the API avoids.
    const failure = await upstream.json().catch(() => ({
      error: { code: "SIGN_IN_FAILED", message: "Не получилось войти." },
    }));
    return NextResponse.json(failure, { status: upstream.status });
  }

  const session = (await upstream.json()) as { sessionId: string; familyId?: string };

  // A parent with no family yet holds a bootstrap session and can only
  // create one, so send them to setup rather than a dashboard that would
  // have nothing to show and no permission to load it (DISC-P1-031-1).
  const next = session.familyId ? "/parent/dashboard" : "/parent/family-setup";

  const response = NextResponse.json({ next });
  response.cookies.set(
    SESSION_COOKIE_NAME,
    session.sessionId,
    sessionCookieOptions({ isDevelopment: process.env.NODE_ENV === "development" }),
  );
  return response;
}
