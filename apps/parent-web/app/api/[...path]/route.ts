import { cookies } from "next/headers";
import { PROXY_PATH_PREFIX, SESSION_COOKIE_NAME, proxyToApi } from "@life/web-session";
import { apiBaseUrl } from "../../../lib/config";

/**
 * Same-origin API proxy (P1-010).
 *
 * Every browser request to the API goes through here so the session
 * token stays in an httpOnly cookie the client script cannot read. The
 * allowlisting, header filtering and redirect handling all live in
 * @life/web-session (and are unit-tested there); this route is the thin
 * Next binding.
 *
 * `runtime = "nodejs"` because reading cookies and forwarding a request
 * body needs the Node runtime, not edge.
 */
export const runtime = "nodejs";
// The proxy must never be cached: responses are per-session.
export const dynamic = "force-dynamic";

async function handle(request: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  const url = new URL(request.url);
  const jar = await cookies();

  // The catch-all gives the segments after /api. Only the v1 surface is
  // proxied, and it is checked explicitly -- slicing the version segment
  // off without verifying it would silently rewrite /api/foo/bar into
  // /api/v1/bar rather than rejecting it.
  if (path[0] !== "v1") {
    return Response.json({ error: { code: "NOT_FOUND", message: "Неизвестный адрес." } }, { status: 404 });
  }

  try {
    return await proxyToApi(
      {
        method: request.method,
        path: `${PROXY_PATH_PREFIX}${path.slice(1).join("/")}`,
        search: url.search,
        headers: request.headers,
        body: request.method === "GET" || request.method === "HEAD" ? null : await request.arrayBuffer(),
      },
      {
        apiBaseUrl: apiBaseUrl(),
        readToken: () => jar.get(SESSION_COOKIE_NAME)?.value,
      },
    );
  } catch {
    // Never leak the upstream URL or a stack trace; mirror the API's own
    // ErrorEnvelope shape so clients have one error format.
    return Response.json({ error: { code: "BAD_GATEWAY", message: "Не получилось связаться с сервисом." } }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
