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
  .inputValidator((d: { username: string; password: string }) => d)
  .handler(async ({ data }) => {
    const { q, tbl } = await import("./server/db");
    const { verifyPassword, startSession } = await import("./server/session");
    const username = String(data.username ?? "").trim().toLowerCase();
    const rows = await q<{ id: string; password_hash: string; username: string; display_name: string | null; is_super: boolean }>(
      `select id, password_hash, username, display_name, is_super from ${tbl("admin_users")} where lower(username) = $1`,
      [username],
    );
    const u = rows[0];
    // constant-ish work even when the user doesn't exist
    const ok = u ? await verifyPassword(String(data.password ?? ""), u.password_hash) : false;
    if (!u || !ok) return { user: null, error: { message: "Invalid login credentials" } };
    await startSession(u.id);
    return { user: { id: u.id, username: u.username, display_name: u.display_name, is_super: u.is_super }, error: null };
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
