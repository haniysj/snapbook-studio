// Server-only: a small, whitelisted query engine that replaces Supabase's REST + RLS.
// Every table, column, operation and permission is declared here explicitly.
import { q, tbl, ident } from "./db";
import { currentAdmin } from "./session";

type ColType = "uuid" | "text" | "int" | "num" | "bool" | "date" | "time" | "ts" | "enum";
type TableDef = {
  cols: Record<string, ColType>;
  /** Public (not signed-in) select allowed; `forceActive` adds `active = true`. */
  publicSelect?: boolean;
  forceActive?: boolean;
  publicInsert?: boolean;
};

export const TABLES: Record<string, TableDef> = {
  settings: {
    cols: {
      id: "int", site_name: "text", logo_url: "text", whatsapp_number: "text",
      bank_details: "text", instagram_url: "text", theme: "text", updated_at: "ts",
      invoice_header: "text", invoice_footer: "text", quote_header: "text", quote_footer: "text", quote_contact_link: "text",
      quote_letterhead: "bool", invoice_letterhead: "bool",
    },
    publicSelect: true,
  },
  packages: {
    cols: {
      id: "uuid", name_ar: "text", name_en: "text", description_ar: "text", description_en: "text",
      price: "num", currency: "text", sort_order: "int", active: "bool", created_at: "ts",
      discounted_price: "num", offer_expiry_date: "ts",
    },
    publicSelect: true,
    forceActive: true,
  },
  gallery_categories: {
    cols: { id: "uuid", name_ar: "text", name_en: "text", sort_order: "int" },
    publicSelect: true,
  },
  gallery_images: {
    cols: {
      id: "uuid", url: "text", title_ar: "text", category_id: "uuid", sort_order: "int",
      active: "bool", created_at: "ts", media_type: "text",
    },
    publicSelect: true,
    forceActive: true,
  },
  bookings: {
    cols: {
      id: "uuid", customer_name: "text", phone: "text", event_location_url: "text", event_date: "date",
      event_time: "time", package_id: "uuid", status: "enum", notes: "text", service_type: "text", created_at: "ts", updated_at: "ts",
    },
    publicInsert: true,
  },
};

/** Foreign-key embeds supported in select strings, e.g. "*, packages(name_ar)". */
const RELATIONS: Record<string, Record<string, { fk: string; table: string }>> = {
  bookings: { packages: { fk: "package_id", table: "packages" } },
  gallery_images: { gallery_categories: { fk: "category_id", table: "gallery_categories" } },
};

export type Filter = { col: string; op: "eq" | "neq" | "in"; value: unknown };
export type QueryReq = {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  select?: string;
  filters?: Filter[];
  order?: { col: string; asc: boolean }[];
  limit?: number;
  values?: Record<string, unknown> | Record<string, unknown>[];
  returning?: boolean;
};

function selectExpr(col: string, t: ColType) {
  const c = ident(col);
  if (t === "num") return `${c}::float8 as ${c}`;
  if (t === "date" || t === "time" || t === "enum") return `${c}::text as ${c}`;
  if (t === "ts") return `to_char(${c} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as ${c}`;
  return c;
}

function parseSelect(table: string, s = "*") {
  const def = TABLES[table];
  const embeds: { name: string; cols: string[] }[] = [];
  const base: string[] = [];
  // split on commas not inside parentheses
  let depth = 0, cur = "";
  const parts: string[] = [];
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  for (const p of parts) {
    const m = p.match(/^([a-z_]+)\((.*)\)$/);
    if (m) {
      if (!RELATIONS[table]?.[m[1]]) throw new Error(`Unknown relation ${m[1]}`);
      embeds.push({ name: m[1], cols: m[2].split(",").map((x) => x.trim()).filter(Boolean) });
    } else if (p === "*") base.push(...Object.keys(def.cols));
    else if (def.cols[p]) base.push(p);
    else throw new Error(`Unknown column ${p}`);
  }
  return { base: [...new Set(base)], embeds };
}

function cleanValues(table: string, values: Record<string, unknown>) {
  const def = TABLES[table];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (!def.cols[k]) continue; // silently drop unknown / UI-only fields
    if (k === "created_at" || k === "updated_at") continue;
    out[k] = v === "" && (def.cols[k] === "uuid" || def.cols[k] === "num" || def.cols[k] === "ts") ? null : v;
  }
  return out;
}

function whereClause(table: string, filters: Filter[] = [], params: unknown[]) {
  const def = TABLES[table];
  const parts: string[] = [];
  for (const f of filters) {
    if (!def.cols[f.col]) throw new Error(`Unknown column ${f.col}`);
    const c = ident(f.col);
    if (f.op === "in") {
      params.push(f.value);
      parts.push(`${c}::text = any($${params.length}::text[])`);
    } else {
      if (f.value === null) { parts.push(`${c} is ${f.op === "eq" ? "" : "not "}null`); continue; }
      params.push(f.value);
      parts.push(`${c}::text ${f.op === "eq" ? "=" : "<>"} $${params.length}::text`);
    }
  }
  return parts.length ? ` where ${parts.join(" and ")}` : "";
}

function validatePublicBooking(v: Record<string, unknown>) {
  const name = String(v.customer_name ?? "").trim();
  const phone = String(v.phone ?? "").trim();
  const date = String(v.event_date ?? "");
  const today = new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 10); // Oman (UTC+4)
  if (name.length < 2 || name.length > 100) throw new Error("Invalid name");
  if (phone.length < 5 || phone.length > 30) throw new Error("Invalid phone");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) throw new Error("Invalid date");
  if (v.status && v.status !== "pending") throw new Error("Invalid status");
  const service_type = String(v.service_type ?? "").trim().slice(0, 60);
  return { ...v, customer_name: name, phone, service_type, status: "pending" };
}

export async function runQuery(req: QueryReq) {
  const def = TABLES[req.table];
  if (!def) throw new Error(`Unknown table ${req.table}`);
  const admin = await currentAdmin();
  const params: unknown[] = [];

  if (req.op === "select") {
    if (!admin && !def.publicSelect) throw new Error("Unauthorized");
    const { base, embeds } = parseSelect(req.table, req.select);
    const filters = [...(req.filters ?? [])];
    if (!admin && def.forceActive) filters.push({ col: "active", op: "eq", value: true });
    let text = `select ${base.map((c) => selectExpr(c, def.cols[c])).join(", ")} from ${tbl(req.table)}`;
    text += whereClause(req.table, filters, params);
    if (req.order?.length) {
      text += " order by " + req.order.map((o) => {
        if (!def.cols[o.col]) throw new Error(`Unknown column ${o.col}`);
        return `${ident(o.col)} ${o.asc ? "asc" : "desc"}`;
      }).join(", ");
    }
    if (req.limit) text += ` limit ${Math.max(1, Math.min(1000, Number(req.limit) | 0))}`;
    const rows = await q<Record<string, any>>(text, params);

    for (const e of embeds) {
      const rel = RELATIONS[req.table][e.name];
      const rdef = TABLES[rel.table];
      const ids = [...new Set(rows.map((r) => r[rel.fk]).filter(Boolean))];
      const cols = e.cols.includes("*") ? Object.keys(rdef.cols) : e.cols;
      cols.forEach((c) => { if (!rdef.cols[c]) throw new Error(`Unknown column ${c}`); });
      const related = ids.length
        ? await q<Record<string, any>>(
            `select id::text as "__id", ${cols.map((c) => selectExpr(c, rdef.cols[c])).join(", ")} from ${tbl(rel.table)} where id::text = any($1::text[])`,
            [ids],
          )
        : [];
      const map = new Map(related.map((r) => [r.__id, r]));
      for (const r of rows) {
        const hit = map.get(r[rel.fk]);
        if (hit) { const { __id, ...rest } = hit; r[e.name] = rest; } else r[e.name] = null;
      }
    }
    return rows;
  }

  if (req.op === "insert") {
    const list = Array.isArray(req.values) ? req.values : [req.values ?? {}];
    if (!admin && !(def.publicInsert && list.length === 1)) throw new Error("Unauthorized");
    const out: any[] = [];
    for (const raw of list) {
      const vals = cleanValues(req.table, admin ? raw : validatePublicBooking(raw));
      const keys = Object.keys(vals);
      if (!keys.length) throw new Error("Nothing to insert");
      const ph = keys.map((_, i) => `$${i + 1}`);
      const rows = await q(
        `insert into ${tbl(req.table)} (${keys.map(ident).join(", ")}) values (${ph.join(", ")}) returning id`,
        keys.map((k) => vals[k]),
      );
      out.push(...rows);
    }
    if (req.table === "bookings" && out[0]?.id) {
      // Alert every supervisor's devices about the new booking — also when the booking is made
      // from a browser that happens to be signed in to the dashboard (e.g. testing on the same phone).
      const { notifyNewBooking } = await import("./push");
      await notifyNewBooking(String(out[0].id));
    }
    return admin ? out : null; // anonymous callers never read rows back
  }

  if (!admin) throw new Error("Unauthorized");

  if (req.op === "update") {
    const vals = cleanValues(req.table, (req.values ?? {}) as Record<string, unknown>);
    delete vals.id;
    const keys = Object.keys(vals);
    if (!keys.length) return [];
    keys.forEach((k) => params.push(vals[k]));
    let text = `update ${tbl(req.table)} set ${keys.map((k, i) => `${ident(k)} = $${i + 1}`).join(", ")}`;
    if (def.cols.updated_at) text += `, updated_at = now()`;
    const where = whereClause(req.table, req.filters, params);
    if (!where) throw new Error("Refusing to update without a filter");
    return q(text + where + " returning id", params);
  }

  if (req.op === "delete") {
    const where = whereClause(req.table, req.filters, params);
    if (!where) throw new Error("Refusing to delete without a filter");
    return q(`delete from ${tbl(req.table)}${where} returning id`, params);
  }

  throw new Error("Unsupported operation");
}

export async function runRpc(name: string) {
  if (name === "get_booked_dates") {
    return q(`select event_date::text as event_date from ${tbl("bookings")} where status in ('pending','confirmed')`);
  }
  if (name === "is_admin" || name === "has_role") {
    return !!(await currentAdmin());
  }
  throw new Error(`Unknown function ${name}`);
}
