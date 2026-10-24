// Server-only: Neon Postgres access. Never import this from client code
// except via dynamic import inside a server function handler.
import { neon } from "@neondatabase/serverless";

export const SCHEMA = "seven";

let _sql: ReturnType<typeof neon> | null = null;

export function sql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL environment variable (connect Neon to the Vercel project).");
  _sql = neon(url);
  return _sql;
}

/** Run a parameterised query and return rows. */
export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await sql().query(text, params)) as T[];
}

export const ident = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return `"${name}"`;
};

export const tbl = (name: string) => `${SCHEMA}.${ident(name)}`;
