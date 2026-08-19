import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ProxyPathNotAllowedError,
  clearedSessionCookieOptions,
  forwardableHeaders,
  proxyToApi,
  resolveUpstreamUrl,
  sessionCookieOptions,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Cookie policy
// ---------------------------------------------------------------------------

test("the session cookie is always httpOnly -- the whole design depends on it", () => {
  assert.equal(sessionCookieOptions().httpOnly, true);
  assert.equal(sessionCookieOptions({ isDevelopment: true }).httpOnly, true);
  assert.equal(clearedSessionCookieOptions().httpOnly, true);
});

test("secure defaults on, and only development may turn it off", () => {
  assert.equal(sessionCookieOptions().secure, true);
  assert.equal(sessionCookieOptions({ isDevelopment: false }).secure, true);
  assert.equal(sessionCookieOptions({ isDevelopment: true }).secure, false);
});

test("sameSite is strict -- nothing in Phase 1 needs cross-site authenticated requests", () => {
  assert.equal(sessionCookieOptions().sameSite, "strict");
});

test("clearing the cookie keeps every flag and only zeroes the lifetime", () => {
  const live = sessionCookieOptions();
  const cleared = clearedSessionCookieOptions();
  assert.equal(cleared.maxAge, 0);
  assert.equal(cleared.sameSite, live.sameSite);
  assert.equal(cleared.path, live.path);
  assert.equal(cleared.secure, live.secure);
});

// ---------------------------------------------------------------------------
// Proxy path allowlist (SSRF surface)
// ---------------------------------------------------------------------------

test("proxy forwards only under /api/v1/", () => {
  assert.equal(
    resolveUpstreamUrl("http://api.internal:3000", "/api/v1/child/today", "?childId=abc"),
    "http://api.internal:3000/api/v1/child/today?childId=abc",
  );
  for (const bad of ["/internal/metrics", "/", "/api/v2/x", "api/v1/x"]) {
    assert.throws(() => resolveUpstreamUrl("http://api.internal:3000", bad), ProxyPathNotAllowedError, `must reject ${bad}`);
  }
});

test("proxy refuses path traversal and protocol-relative escapes", () => {
  for (const bad of ["/api/v1/../../internal", "//evil.example.com/api/v1/x"]) {
    assert.throws(() => resolveUpstreamUrl("http://api.internal:3000", bad), ProxyPathNotAllowedError, `must reject ${bad}`);
  }
});

test("a trailing slash on the base URL does not produce a double slash", () => {
  assert.equal(resolveUpstreamUrl("http://api.internal:3000/", "/api/v1/health"), "http://api.internal:3000/api/v1/health");
});

// ---------------------------------------------------------------------------
// Header forwarding
// ---------------------------------------------------------------------------

test("a client-supplied Authorization header is never forwarded", () => {
  const incoming = new Headers({ authorization: "Bearer attacker-chosen-token", "content-type": "application/json" });
  const out = forwardableHeaders(incoming, "real-session-token");
  assert.equal(out.get("authorization"), "Bearer real-session-token");
});

test("with no session, no Authorization header is invented", () => {
  const out = forwardableHeaders(new Headers({ authorization: "Bearer attacker-chosen-token" }), undefined);
  assert.equal(out.get("authorization"), null);
});

test("only allowlisted headers cross the proxy", () => {
  const incoming = new Headers({
    "content-type": "application/json",
    "idempotency-key": "k-1",
    cookie: "life_session=secret",
    "x-forwarded-for": "10.0.0.1",
  });
  const out = forwardableHeaders(incoming, "t");
  assert.equal(out.get("content-type"), "application/json");
  assert.equal(out.get("idempotency-key"), "k-1");
  assert.equal(out.get("cookie"), null, "the raw cookie must not reach the API");
  assert.equal(out.get("x-forwarded-for"), null);
});

// ---------------------------------------------------------------------------
// proxyToApi
// ---------------------------------------------------------------------------

test("proxyToApi attaches the session token and does not follow redirects", async () => {
  let seenUrl = "";
  let seenInit: RequestInit | undefined;
  const fake: typeof fetch = async (url, init) => {
    seenUrl = String(url);
    seenInit = init;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const res = await proxyToApi(
    { method: "GET", path: "/api/v1/child/today", search: "?childId=c1", headers: new Headers() },
    { apiBaseUrl: "http://api.internal:3000", readToken: () => "tok-123", fetchImpl: fake },
  );

  assert.equal(res.status, 200);
  assert.equal(seenUrl, "http://api.internal:3000/api/v1/child/today?childId=c1");
  assert.equal(new Headers(seenInit!.headers).get("authorization"), "Bearer tok-123");
  assert.equal(seenInit!.redirect, "manual", "following a redirect would re-attach the token to another origin");
});

test("proxyToApi returns the upstream status and body unchanged", async () => {
  const fake: typeof fetch = async () =>
    new Response(JSON.stringify({ error: { code: "NOT_ACTIVE_FAMILY_MEMBER", message: "Not authorized for this action." } }), {
      status: 403,
    });
  const res = await proxyToApi(
    { method: "POST", path: "/api/v1/task-assignments/x/approve", headers: new Headers() },
    { apiBaseUrl: "http://api.internal:3000", readToken: () => "t", fetchImpl: fake },
  );
  assert.equal(res.status, 403, "the API's own status must reach the client, not a rewritten one");
  assert.equal((await res.json()).error.code, "NOT_ACTIVE_FAMILY_MEMBER");
});

test("proxyToApi supports an async token read (cookie stores are async in Next)", async () => {
  const fake: typeof fetch = async (_u, init) => new Response(null, { status: 204, headers: new Headers(init?.headers) });
  const res = await proxyToApi(
    { method: "GET", path: "/api/v1/health", headers: new Headers() },
    { apiBaseUrl: "http://api.internal:3000", readToken: async () => "async-tok", fetchImpl: fake },
  );
  assert.equal(res.headers.get("authorization"), "Bearer async-tok");
});
