/**
 * Server-only configuration (P1-010).
 *
 * `API_BASE_URL` is intentionally *not* prefixed `NEXT_PUBLIC_` -- the
 * browser never calls the API directly, so its origin is not something
 * the client needs or should know. Everything goes through the
 * same-origin proxy route.
 */
export function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? "http://localhost:3000";
}
