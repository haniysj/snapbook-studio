// Seven Studio data client.
// The original Lovable Cloud (Supabase) backend was deleted, so this module now talks to
// Neon (via TanStack server functions) and Vercel Blob. It keeps a Supabase-like surface
// (`from().select().eq().order()`, `rpc`, `auth`, `storage`) so the UI code stays unchanged.
import { authLogin, authLogout, authMe, dbQuery, dbRpc, mediaDelete } from "@/lib/api.functions";
import type { Filter, QueryReq } from "@/lib/server/query";

type Result<T = any> = { data: T; error: { message: string } | null };

class QueryBuilder<T = any> implements PromiseLike<Result<T>> {
  private req: QueryReq;
  private single: "none" | "maybe" | "single" = "none";
  constructor(table: string) {
    this.req = { table, op: "select", filters: [], order: [] };
  }
  select(cols = "*") {
    if (this.req.op === "select") this.req.select = cols;
    else this.req.returning = true;
    return this;
  }
  insert(values: any) { this.req.op = "insert"; this.req.values = values; return this; }
  update(values: any) { this.req.op = "update"; this.req.values = values; return this; }
  upsert(values: any) { this.req.op = "insert"; this.req.values = values; return this; }
  delete() { this.req.op = "delete"; return this; }
  eq(col: string, value: unknown) { this.req.filters!.push({ col, op: "eq", value } as Filter); return this; }
  neq(col: string, value: unknown) { this.req.filters!.push({ col, op: "neq", value } as Filter); return this; }
  in(col: string, value: unknown[]) { this.req.filters!.push({ col, op: "in", value } as Filter); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this.req.order!.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) { this.req.limit = n; return this; }
  maybeSingle() { this.single = "maybe"; return this as unknown as QueryBuilder<any>; }
  singleRow() { this.single = "single"; return this; }

  private async exec(): Promise<Result<T>> {
    try {
      const res = await dbQuery({ data: this.req });
      if (res.error) return { data: null as any, error: res.error };
      let data: any = res.data;
      if (this.single !== "none") {
        data = Array.isArray(data) ? (data[0] ?? null) : data;
        if (this.single === "single" && !data) return { data: null as any, error: { message: "No rows" } };
      }
      return { data, error: null };
    } catch (e: any) {
      return { data: null as any, error: { message: e?.message ?? "Network error" } };
    }
  }
  then<A = Result<T>, B = never>(
    onfulfilled?: ((value: Result<T>) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: any) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.exec().then(onfulfilled, onrejected);
  }
}

/* ---------------- auth (PIN-only admin login) ---------------- */
export type AppUser = { id: string; email: string; user_metadata: { display_name: string; is_super: boolean } };
export type Session = { user: AppUser };
type Listener = (event: string, session: Session | null) => void;

const listeners = new Set<Listener>();
let cached: Session | null | undefined;

const toSession = (u: { id: string; display_name: string; is_super: boolean } | null): Session | null =>
  u
    ? { user: { id: u.id, email: `${u.display_name}@sevenphoto.local`, user_metadata: { display_name: u.display_name, is_super: u.is_super } } }
    : null;

function emit(event: string, s: Session | null) {
  cached = s;
  listeners.forEach((l) => { try { l(event, s); } catch { /* ignore */ } });
}

const auth = {
  async getSession() {
    if (cached === undefined) {
      try { cached = toSession(await authMe()); } catch { cached = null; }
    }
    return { data: { session: cached }, error: null };
  },
  async getUser() {
    const { data } = await auth.getSession();
    return { data: { user: data.session?.user ?? null }, error: null };
  },
  onAuthStateChange(cb: Listener) {
    listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => { listeners.delete(cb); } } } };
  },
  /** Error message is "invalid" (wrong PIN) or "locked" (too many attempts). */
  async signInWithPin(pin: string) {
    try {
      const res = await authLogin({ data: { pin } });
      if (res.error || !res.user) return { data: { session: null }, error: res.error ?? { message: "invalid" } };
      const s = toSession(res.user);
      emit("SIGNED_IN", s);
      return { data: { session: s }, error: null };
    } catch (e: any) {
      return { data: { session: null }, error: { message: e?.message ?? "error" } };
    }
  },
  async signOut() {
    try { await authLogout(); } catch { /* ignore */ }
    emit("SIGNED_OUT", null);
    return { error: null };
  },
};

/* ---------------- storage (Vercel Blob) ---------------- */
/** Browser-usable URL for a stored file. Private Blob files go through /api/media (signed redirect). */
export function mediaSrc(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/")) return url; // bundled asset, e.g. /brand/logo-black.png
  if (!url.startsWith("http")) return "";
  if (/\.blob\.vercel-storage\.com\//.test(url)) return `/api/media?u=${encodeURIComponent(url)}`;
  return url;
}

const storage = {
  from(_bucket: string) {
    return {
      async upload(path: string, file: File, opts?: { contentType?: string; upsert?: boolean }) {
        try {
          const { uploadPresigned } = await import("@vercel/blob/client");
          const blob = await uploadPresigned(path, file, {
            access: "private",
            handleUploadUrl: "/api/upload",
            contentType: opts?.contentType || file.type || undefined,
          });
          return { data: { path: blob.url, fullPath: blob.url, url: blob.url }, error: null };
        } catch (e: any) {
          return { data: null, error: { message: e?.message ?? "Upload failed" } };
        }
      },
      async remove(paths: string[]) {
        try {
          await mediaDelete({ data: { urls: paths } });
          return { data: paths, error: null };
        } catch (e: any) {
          return { data: null, error: { message: e?.message ?? "Delete failed" } };
        }
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: mediaSrc(path) } };
      },
      async createSignedUrl(path: string, _expires?: number) {
        return { data: { signedUrl: mediaSrc(path) }, error: null };
      },
    };
  },
};

async function rpc(name: string, _args?: Record<string, unknown>) {
  try {
    return await dbRpc({ data: { name } });
  } catch (e: any) {
    return { data: null, error: { message: e?.message ?? "Error" } };
  }
}

export const supabase = {
  from: (table: string) => new QueryBuilder<any[]>(table),
  rpc,
  auth,
  storage,
};
