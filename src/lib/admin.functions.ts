import { createServerFn } from "@tanstack/react-start";

// Admin-user management (Neon). Every handler requires a signed-in admin.

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

function cleanUsername(u: string) {
  const v = String(u ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(v)) throw new Error("Username: 3–32 chars, letters/numbers/._- only");
  return v;
}

export const listAdminUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./server/session");
  const { q, tbl } = await import("./server/db");
  await requireAdmin();
  const rows = await q<{ id: string; username: string; display_name: string | null; is_super: boolean }>(
    `select id::text as id, username, display_name, is_super from ${tbl("admin_users")} order by created_at`,
  );
  return {
    users: rows.map((r) => ({
      id: r.id,
      username: r.username,
      display_name: r.display_name,
      roles: r.is_super ? ["admin", "super_admin"] : ["admin"],
    })),
  };
});

export const createAdminUser = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string; display_name?: string; is_super?: boolean }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin, hashPassword } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    await requireAdmin();
    const username = cleanUsername(data.username);
    if (String(data.password ?? "").length < 6) throw new Error("Password must be at least 6 characters");
    const exists = await q(`select 1 from ${tbl("admin_users")} where lower(username) = $1`, [username]);
    if (exists.length) throw new Error("Username already exists");
    const rows = await q<{ id: string }>(
      `insert into ${tbl("admin_users")} (username, display_name, password_hash, is_super) values ($1, $2, $3, $4) returning id::text as id`,
      [username, data.display_name || username, await hashPassword(data.password), !!data.is_super],
    );
    return { id: rows[0].id };
  });

export const updateAdminUser = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; username?: string; password?: string; display_name?: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin, hashPassword } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    await requireAdmin();
    const sets: string[] = [];
    const params: unknown[] = [];
    if (data.username) {
      const username = cleanUsername(data.username);
      const clash = await q(`select 1 from ${tbl("admin_users")} where lower(username) = $1 and id::text <> $2`, [username, data.id]);
      if (clash.length) throw new Error("Username already exists");
      params.push(username); sets.push(`username = $${params.length}`);
    }
    if (data.display_name !== undefined) { params.push(data.display_name); sets.push(`display_name = $${params.length}`); }
    if (data.password) {
      if (data.password.length < 6) throw new Error("Password must be at least 6 characters");
      params.push(await hashPassword(data.password)); sets.push(`password_hash = $${params.length}`);
    }
    if (sets.length) {
      params.push(data.id);
      await q(`update ${tbl("admin_users")} set ${sets.join(", ")}, updated_at = now() where id::text = $${params.length}`, params);
    }
    return { ok: true };
  });

export const deleteAdminUser = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    const me = await requireAdmin();
    if (data.id === me.id) throw new Error("Cannot delete yourself");
    const left = await q(`select count(*)::int as n from ${tbl("admin_users")} where id::text <> $1`, [data.id]);
    if ((left[0] as any).n < 1) throw new Error("At least one admin must remain");
    await q(`delete from ${tbl("admin_users")} where id::text = $1`, [data.id]);
    return { ok: true };
  });
