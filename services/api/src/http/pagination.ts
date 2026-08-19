/**
 * Cursor pagination helper (P1-026). openapi.yaml's Cursor parameter is
 * "opaque" -- callers must not parse it -- so this base64-encodes the
 * underlying sort key (a timestamp) rather than exposing it directly.
 */
function encodeCursor(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, "base64url").toString("utf8");
}

export interface CursorPage<T> {
  items: T[];
  page_info: { has_next_page: boolean; next_cursor: string | null };
}

/**
 * `rows` must be fetched with `limit + 1` so this can tell whether
 * another page exists without a second round-trip; the extra row is
 * trimmed before returning.
 */
export function buildCursorPage<T>(rows: T[], limit: number, cursorOf: (item: T) => string): CursorPage<T> {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    page_info: {
      has_next_page: hasNextPage,
      next_cursor: hasNextPage && last ? encodeCursor(cursorOf(last)) : null,
    },
  };
}
