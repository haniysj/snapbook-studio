import { createServerFn } from "@tanstack/react-start";
import type { QueryReq } from "./server/query";

/* All handlers import server code dynamically so nothing server-only reaches the browser bundle. */

export const dbQuery = createServerFn({ method: "POST" })
  .inputValidator((d: QueryReq) => d)
  .handler(async ({ data }) => {
    const { runQuery } = await import("./server/query");
    try {
      return { data: await runQuery(data), error: null as null | { message: string } };
    } catch (e: any) {
      console.error("dbQuery", data.table, data.op, e?.message);
      return { data: null, error: { message: e?.message ?? "Error" } };
    }
  });

export const dbRpc = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data }) => {
    const { runRpc } = await import("./server/query");
    try {
      return { data: (await runRpc(data.name)) as any, error: null as null | { message: string } };
    } catch (e: any) {
      return { data: null, error: { message: e?.message ?? "Error" } };
    }
  });

export const authMe = createServerFn({ method: "GET" }).handler(async () => {
  const { currentAdmin } = await import("./server/session");
  try {
    return await currentAdmin();
  } catch (e: any) {
    console.error("authMe", e?.message);
    return null;
  }
});

export const authLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => d)
  .handler(async ({ data }) => {
    const { q, tbl } = await import("./server/db");
    const { verifyPassword, startSession, PIN_RE } = await import("./server/session");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const ip = (getRequestHeader("x-forwarded-for") ?? "unknown").split(",")[0].trim();
    const fail = (message: string) => ({ user: null, error: { message } });

    // Brute-force guard: at most 5 wrong PINs per IP per 15 minutes.
    await q(`delete from ${tbl("login_attempts")} where at < now() - interval '1 day'`);
    const recent = await q<{ n: number }>(
      `select count(*)::int as n from ${tbl("login_attempts")} where ip = $1 and at > now() - interval '15 minutes'`,
      [ip],
    );
    if ((recent[0]?.n ?? 0) >= 5) return fail("locked");

    const pin = String(data.pin ?? "").trim();
    let match: { id: string; display_name: string; is_super: boolean } | null = null;
    if (PIN_RE.test(pin)) {
      const users = await q<{ id: string; display_name: string; is_super: boolean; pin_hash: string }>(
        `select id::text as id, display_name, is_super, pin_hash from ${tbl("admin_users")} order by is_super desc, created_at`,
      );
      for (const u of users) {
        if (await verifyPassword(pin, u.pin_hash)) { match = { id: u.id, display_name: u.display_name, is_super: u.is_super }; break; }
      }
    }
    if (!match) {
      await q(`insert into ${tbl("login_attempts")} (ip) values ($1)`, [ip]);
      return fail("invalid");
    }
    await q(`delete from ${tbl("login_attempts")} where ip = $1`, [ip]);
    await startSession(match.id);
    return { user: match, error: null };
  });

export const authLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { endSession } = await import("./server/session");
  endSession();
  return { ok: true };
});

/** Deletes a file from Vercel Blob (admin only). */
export const mediaDelete = createServerFn({ method: "POST" })
  .inputValidator((d: { urls: string[] }) => d)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./server/session");
    await requireAdmin();
    const urls = (data.urls ?? []).filter((u) => /^https:\/\/[a-z0-9-]+\.(public|private)\.blob\.vercel-storage\.com\//.test(u));
    if (urls.length) {
      const { del } = await import("@vercel/blob");
      await del(urls);
    }
    return { ok: true };
  });
