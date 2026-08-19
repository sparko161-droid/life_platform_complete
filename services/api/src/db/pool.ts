import { Pool, type PoolClient } from "pg";

/**
 * Lazy singleton pg Pool (P1-025). `DATABASE_URL` matches
 * docker-compose.dev.yml's dev stack; see .env.example.
 */
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set (see .env.example)");
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

/** Test-only: drop the singleton so a new DATABASE_URL takes effect. */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

/**
 * Runs `fn` inside a single transaction (BEGIN/COMMIT, ROLLBACK on
 * throw). Every repository mutation in this package uses this, not a
 * bare pool query -- the read-modify-write (SELECT ... FOR UPDATE ->
 * domain function -> UPDATE ... WHERE version = $n) sequence that
 * enforces optimistic concurrency (docs/architecture/concurrency-and-conflicts.md;
 * closes DISC-P1-021-2/RT-010) is only safe inside one transaction.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
