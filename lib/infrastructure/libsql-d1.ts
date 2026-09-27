import { createClient, type Client, type InStatement, type InValue, type ResultSet } from '@libsql/client';

/**
 * D1's `prepare().bind().all()/first()/run()` and `batch()` surface over a
 * libSQL client, so every `*-d1.ts` module runs unchanged on Turso (or any
 * libSQL server) when the app is hosted somewhere without Cloudflare
 * bindings — Vercel, in the first instance. libSQL *is* SQLite, so the SQL
 * these modules write (`INSERT OR IGNORE`, `COLLATE NOCASE`, `changes()`,
 * `VALUES (...)` tables) needs no translation; `batch` runs its statements
 * in one transaction on one connection, which is what the `changes()`
 * guards in `d1-hotel-repository.ts` rely on. Only what the codebase uses
 * is implemented — no `raw()`, no `exec()`, no `dump()`.
 */

interface Meta {
  changes: number;
  last_row_id: number;
  duration: number;
  rows_read: number;
  rows_written: number;
  size_after: number;
  changed_db: boolean;
}

function meta(result: ResultSet): Meta {
  return {
    changes: result.rowsAffected,
    last_row_id: Number(result.lastInsertRowid ?? 0),
    duration: 0,
    rows_read: result.rows.length,
    rows_written: result.rowsAffected,
    size_after: 0,
    changed_db: result.rowsAffected > 0,
  };
}

/** libSQL rows are array-likes with column names as own properties; D1 hands back plain objects. */
function toObject<T>(result: ResultSet, row: ResultSet['rows'][number]): T {
  const out: Record<string, unknown> = {};
  result.columns.forEach((column, index) => {
    const value = row[index];
    out[column] = value instanceof ArrayBuffer ? value : value;
  });
  return out as T;
}

class LibsqlPreparedStatement {
  constructor(
    private readonly client: Client,
    private readonly sql: string,
    private readonly args: InValue[] = [],
  ) {}

  bind(...values: unknown[]): LibsqlPreparedStatement {
    return new LibsqlPreparedStatement(this.client, this.sql, values as InValue[]);
  }

  /** @internal what `batch` sends. */
  toStatement(): InStatement {
    return { sql: this.sql, args: this.args };
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: true; meta: Meta }> {
    const result = await this.client.execute(this.toStatement());
    return { results: result.rows.map((row) => toObject<T>(result, row)), success: true, meta: meta(result) };
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const result = await this.client.execute(this.toStatement());
    const row = result.rows[0];
    if (!row) return null;
    const object = toObject<Record<string, unknown>>(result, row);
    return (column ? (object[column] as T) : (object as T)) ?? null;
  }

  async run<T = Record<string, unknown>>(): Promise<{ results: T[]; success: true; meta: Meta }> {
    const result = await this.client.execute(this.toStatement());
    return { results: [], success: true, meta: meta(result) };
  }
}

export class LibsqlD1 {
  constructor(private readonly client: Client) {}

  prepare(sql: string): LibsqlPreparedStatement {
    return new LibsqlPreparedStatement(this.client, sql);
  }

  async batch<T = Record<string, unknown>>(
    statements: LibsqlPreparedStatement[],
  ): Promise<{ results: T[]; success: true; meta: Meta }[]> {
    const results = await this.client.batch(
      statements.map((statement) => statement.toStatement()),
      'write',
    );
    return results.map((result) => ({
      results: result.rows.map((row) => toObject<T>(result, row)),
      success: true as const,
      meta: meta(result),
    }));
  }
}

/** The D1 stand-in for a libSQL URL (`libsql://…` on Turso, `file:` or `:memory:` locally) — typed as D1 so the stores need no second signature. */
export function createLibsqlD1(url: string, authToken?: string): D1Database {
  return new LibsqlD1(createClient({ url, authToken })) as unknown as D1Database;
}
