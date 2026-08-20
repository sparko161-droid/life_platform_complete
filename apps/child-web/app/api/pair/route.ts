import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@life/web-session";
import { apiBaseUrl } from "../../../lib/config";

/**
 * Child pairing route handler (P1-036), closing DISC-P1-032-1.
 *
 * The child device posts the code a parent read out; this exchanges it
 * for a session server-side and writes that session into an httpOnly
 * cookie. As on the parent surface, the session value never appears in a
 * response body and never reaches client JavaScript.
 *
 * That property matters more here than anywhere else: a child device is
 * the most likely to be shared, left unlocked, or handed around.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Не получилось прочитать код." } }, { status: 400 });
  }

  const upstream = await fetch(`${apiBaseUrl()}/api/v1/auth/child-pairing-codes/redeem`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: body.code }),
    redirect: "manual",
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(
      { error: { code: "NETWORK_ERROR", message: "Нет связи. Попробуй ещё раз." } },
      { status: 503 },
    );
  }

  if (!upstream.ok) {
    // The API gives one answer for unknown, expired and already-used, so
    // that a guessed code cannot be confirmed as real. Passing it through
    // unchanged keeps that true.
    return NextResponse.json(
      { error: { code: "PAIRING_FAILED", message: "Код не подошёл. Попроси взрослого создать новый." } },
      { status: upstream.status },
    );
  }

  const session = (await upstream.json()) as { sessionId: string };
  const response = NextResponse.json({ next: "/child/today" });
  response.cookies.set(
    SESSION_COOKIE_NAME,
    session.sessionId,
    sessionCookieOptions({ isDevelopment: process.env.NODE_ENV === "development" }),
  );
  return response;
}
