import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden");
}

function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@sevenphoto.local`;
}

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin.from("admin_profiles").select("*").order("created_at");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("*");
    return {
      users: (profiles ?? []).map((p) => ({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        roles: (roles ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
      })),
    };
  });

export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { username: string; password: string; display_name?: string; is_super?: boolean }) => data)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = usernameToEmail(data.username);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email, password: data.password, email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");
    const uid = created.user.id;
    await supabaseAdmin.from("admin_profiles").insert({ id: uid, username: data.username, display_name: data.display_name ?? data.username });
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" });
    if (data.is_super) await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "super_admin" });
    return { id: uid };
  });

export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; username?: string; password?: string; display_name?: string }) => data)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUpdate: any = {};
    if (data.password) authUpdate.password = data.password;
    if (data.username) authUpdate.email = usernameToEmail(data.username);
    if (Object.keys(authUpdate).length) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, authUpdate);
      if (error) throw new Error(error.message);
    }
    const profUpdate: any = {};
    if (data.username) profUpdate.username = data.username;
    if (data.display_name !== undefined) profUpdate.display_name = data.display_name;
    if (Object.keys(profUpdate).length) {
      await supabaseAdmin.from("admin_profiles").update(profUpdate).eq("id", data.id);
    }
    return { ok: true };
  });

export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (data.id === context.userId) throw new Error("Cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
