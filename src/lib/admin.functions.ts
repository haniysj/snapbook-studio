import { createServerFn } from "@tanstack/react-start";

// Admin accounts (PIN-only). Only the general supervisor (is_super) can manage accounts.

export const listAdminUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { requireSuper } = await import("./server/session");
  const { q, tbl } = await import("./server/db");
  const me = await requireSuper();
  const rows = await q<{ id: string; display_name: string; is_super: boolean; created_at: string }>(
    `select id::text as id, display_name, is_super, to_char(created_at, 'YYYY-MM-DD') as created_at
       from ${tbl("admin_users")} order by is_super desc, created_at`,
  );
  return { me: me.id, users: rows };
});

export const createAdminUser = createServerFn({ method: "POST" })
  .inputValidator((data: { display_name: string; pin: string; is_super?: boolean }) => data)
  .handler(async ({ data }) => {
    const { requireSuper, hashPassword, checkPinFormat, assertPinUnique } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    await requireSuper();
    const name = String(data.display_name ?? "").trim();
    if (name.length < 2 || name.length > 60) throw new Error("Name must be 2–60 characters");
    checkPinFormat(data.pin);
    await assertPinUnique(data.pin);
    const rows = await q<{ id: string }>(
      `insert into ${tbl("admin_users")} (display_name, pin_hash, is_super) values ($1, $2, $3) returning id::text as id`,
      [name, await hashPassword(data.pin), !!data.is_super],
    );
    return { id: rows[0].id };
  });

export const updateAdminUser = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; display_name?: string; pin?: string; is_super?: boolean }) => data)
  .handler(async ({ data }) => {
    const { requireSuper, hashPassword, checkPinFormat, assertPinUnique } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    const me = await requireSuper();
    const sets: string[] = [];
    const params: unknown[] = [];
    if (data.display_name !== undefined) {
      const name = String(data.display_name).trim();
      if (name.length < 2 || name.length > 60) throw new Error("Name must be 2–60 characters");
      params.push(name); sets.push(`display_name = $${params.length}`);
    }
    if (data.pin) {
      checkPinFormat(data.pin);
      await assertPinUnique(data.pin, data.id);
      params.push(await hashPassword(data.pin)); sets.push(`pin_hash = $${params.length}`);
    }
    if (data.is_super !== undefined) {
      if (data.id === me.id && !data.is_super) throw new Error("You cannot remove your own general-supervisor role");
      params.push(!!data.is_super); sets.push(`is_super = $${params.length}`);
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
    const { requireSuper } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    const me = await requireSuper();
    if (data.id === me.id) throw new Error("You cannot delete your own account");
    await q(`delete from ${tbl("admin_users")} where id::text = $1`, [data.id]);
    return { ok: true };
  });
