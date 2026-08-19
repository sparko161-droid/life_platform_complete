/**
 * Server-side API proxy (P1-010).
 *
 * Runs only on the Next server. It reads the httpOnly session cookie,
 * attaches it as the `Authorization` header, and forwards to the real
 * API. The browser therefore never holds the token, and never needs to
 * know the API's origin either.
 *
 * Deliberate restrictions, each closing a way a proxy like this
 * normally becomes a hole:
 *
 *  - **Allowlisted path prefix.** The proxy forwards only under
 *    `/api/v1/`. Without this, a crafted path could reach any host the
 *    server can see -- the classic SSRF shape.
 *  - **No client-supplied headers are forwarded.** Only
 *    content-type and idempotency-key pass through, both from an
 *    explicit list. In particular a client-supplied `Authorization` is
 *    ignored, so a caller cannot swap in a token of their choosing.
 *  - **No redirect following.** A 3xx from the API is returned as-is
 *    rather than chased to another origin with the token attached.
 */

export const PROXY_PATH_PREFIX = "/api/v1/";

/** Request headers the proxy is willing to forward, lowercased. */
const FORWARDABLE_REQUEST_HEADERS = ["content-type", "idempotency-key"] as const;

export class ProxyPathNotAllowedError extends Error {
  constructor(public readonly path: string) {
    super(`Refusing to proxy ${path}: only ${PROXY_PATH_PREFIX}* is allowed`);
    this.name = "ProxyPathNotAllowedError";
  }
}

/**
 * Builds the upstream URL for an incoming proxy request.
 *
 * `path` must already be the API-relative path (e.g. `/api/v1/child/today`).
 * Rejects anything outside the allowlisted prefix, and anything that
 * tries to escape it with `..` or a scheme.
 */
export function resolveUpstreamUrl(apiBaseUrl: string, path: string, search = ""): string {
  if (!path.startsWith(PROXY_PATH_PREFIX)) {
    throw new ProxyPathNotAllowedError(path);
  }
  // `//host` and `..` are the two ways a "relative" path stops being
  // relative. Neither has a legitimate use here.
  if (path.includes("..") || path.startsWith("//")) {
    throw new ProxyPathNotAllowedError(path);
  }
  const base = apiBaseUrl.replace(/\/+$/, "");
  return `${base}${path}${search}`;
}

/** Picks only the headers the proxy forwards, dropping everything else. */
export function forwardableHeaders(incoming: Headers, token: string | undefined): Headers {
  const out = new Headers();
  for (const name of FORWARDABLE_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value) out.set(name, value);
  }
  // Set last and unconditionally: a client-supplied Authorization was
  // never copied above, so this cannot be overridden by the caller.
  if (token) out.set("authorization", `Bearer ${token}`);
  return out;
}

export interface ProxyRequest {
  method: string;
  path: string;
  search?: string;
  headers: Headers;
  body?: BodyInit | null;
}

export interface ProxyDeps {
  apiBaseUrl: string;
  /** Reads the session token from the httpOnly cookie. Server-side only. */
  readToken: () => string | undefined | Promise<string | undefined>;
  fetchImpl?: typeof fetch;
}

/**
 * Forwards one request to the API with the session token attached.
 * Returns the upstream Response unchanged so status codes and the
 * ErrorEnvelope body reach the client exactly as the API produced them.
 */
export async function proxyToApi(req: ProxyRequest, deps: ProxyDeps): Promise<Response> {
  const url = resolveUpstreamUrl(deps.apiBaseUrl, req.path, req.search ?? "");
  const token = await deps.readToken();
  const doFetch = deps.fetchImpl ?? fetch;
  return doFetch(url, {
    method: req.method,
    headers: forwardableHeaders(req.headers, token),
    ...(req.body !== undefined && req.body !== null ? { body: req.body } : {}),
    redirect: "manual",
  });
}
