import { createServerFn } from "@tanstack/react-start";
import type { Approver, Doc, DocKind } from "./documents";

// Invoices & quotations. Any signed-in supervisor can create/edit; delete = creator or general supervisor.

const COLS = `id::text as id, kind, number, customer_name, customer_phone, customer_extra,
  booking_id::text as booking_id, issue_date::text as issue_date, due_date::text as due_date,
  event_date::text as event_date, items, discount::float8 as discount, vat_rate::float8 as vat_rate,
  paid::float8 as paid, total::float8 as total, notes, status, source_id::text as source_id,
  created_by::text as created_by, created_by_name,
  approver_id::text as approver_id, approver_name, approver_phone, approver_signature,
  to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function clean(d: Doc) {
  const kind: DocKind = d.kind === "quote" ? "quote" : "invoice";
  const name = String(d.customer_name ?? "").trim().slice(0, 120);
  if (name.length < 2) throw new Error("Customer name is required");
  const items = (Array.isArray(d.items) ? d.items : [])
    .map((i) => ({
      desc: String(i?.desc ?? "").trim().slice(0, 800),
      qty: Math.max(0, Math.min(100000, Number(i?.qty) || 0)),
      price: Math.max(0, Math.min(10_000_000, Number(i?.price) || 0)),
    }))
    .filter((i) => i.desc || i.price)
    .slice(0, 50);
  if (!items.length) throw new Error("Add at least one item");
  const date = (v: unknown) => (typeof v === "string" && DATE_RE.test(v) ? v : null);
  const num = (v: unknown, max: number) => Math.max(0, Math.min(max, Number(v) || 0));
  const status = kind === "quote" && ["open", "accepted", "rejected"].includes(String(d.status)) ? String(d.status) : "open";
  return {
    kind,
    customer_name: name,
    customer_phone: String(d.customer_phone ?? "").trim().slice(0, 40),
    customer_extra: String(d.customer_extra ?? "").trim().slice(0, 300),
    booking_id: d.booking_id && /^[0-9a-f-]{36}$/i.test(d.booking_id) ? d.booking_id : null,
    issue_date: date(d.issue_date) ?? new Date().toISOString().slice(0, 10),
    due_date: date(d.due_date),
    event_date: date(d.event_date),
    items,
    discount: num(d.discount, 10_000_000),
    vat_rate: num(d.vat_rate, 100),
    paid: kind === "invoice" ? num(d.paid, 10_000_000) : 0,
    notes: String(d.notes ?? "").trim().slice(0, 1500),
    status,
  };
}

/** Resolves the approver snapshot (quotes only). Unknown/deleted approver on an edit keeps the old snapshot. */
async function approverSnapshot(kind: DocKind, approverId: string | null | undefined) {
  if (kind !== "quote" || !approverId) return { id: null, name: "", phone: "", signature: "" };
  if (!/^[0-9a-f-]{36}$/i.test(approverId)) throw new Error("Invalid approver");
  const { q, tbl } = await import("./server/db");
  const rows = await q<{ id: string; contact_name: string; contact_phone: string; signature: string }>(
    `select id::text as id, contact_name, contact_phone, signature from ${tbl("admin_users")} where id::text = $1`,
    [approverId],
  );
  const a = rows[0];
  // Deleted account or details cleared later: keep whatever the document already has.
  if (!a || !a.contact_name.trim()) return null;
  return { id: a.id, name: a.contact_name, phone: a.contact_phone, signature: a.signature };
}

async function nextNumber(kind: DocKind, issueDate: string) {
  const { q, tbl } = await import("./server/db");
  const prefix = `${kind === "invoice" ? "INV" : "QT"}-${issueDate.slice(0, 4)}-`;
  const rows = await q<{ n: number }>(
    `select coalesce(max(nullif(regexp_replace(substr(number, $2), '\\D', '', 'g'), '')::int), 0) as n
       from ${tbl("documents")} where number like $1`,
    [`${prefix}%`, prefix.length + 1],
  );
  return `${prefix}${String((rows[0]?.n ?? 0) + 1).padStart(3, "0")}`;
}

export const listDocs = createServerFn({ method: "GET" })
  .inputValidator((d: { kind: DocKind }) => d)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    await requireAdmin();
    return await q<Doc & { created_by: string | null }>(
      `select ${COLS} from ${tbl("documents")} where kind = $1 order by created_at desc limit 500`,
      [data.kind === "quote" ? "quote" : "invoice"],
    );
  });

export const saveDoc = createServerFn({ method: "POST" })
  .inputValidator((d: Doc) => d)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    const { docTotals } = await import("./documents");
    const me = await requireAdmin();
    const c = clean(data);
    const total = docTotals(c).total;
    const ap = await approverSnapshot(c.kind, data.approver_id);
    const vals = [c.customer_name, c.customer_phone, c.customer_extra, c.booking_id, c.issue_date, c.due_date,
      c.event_date, JSON.stringify(c.items), c.discount, c.vat_rate, c.paid, total, c.notes, c.status];

    if (data.id) {
      const rows = await q<Doc>(
        `update ${tbl("documents")} set customer_name=$1, customer_phone=$2, customer_extra=$3, booking_id=$4,
            issue_date=$5, due_date=$6, event_date=$7, items=$8::jsonb, discount=$9, vat_rate=$10, paid=$11,
            total=$12, notes=$13, status=$14, updated_at=now()
          where id::text = $15 returning ${COLS}`,
        [...vals, data.id],
      );
      if (!rows[0]) throw new Error("Document not found");
      if (!ap) return rows[0];
      const upd = await q<Doc>(
        `update ${tbl("documents")} set approver_id=$1, approver_name=$2, approver_phone=$3, approver_signature=$4
          where id::text = $5 returning ${COLS}`,
        [ap.id, ap.name, ap.phone, ap.signature, data.id],
      );
      return upd[0];
    }

    // New document: allocate the next number (retry if two people save at the same moment).
    for (let attempt = 0; attempt < 4; attempt++) {
      const number = await nextNumber(c.kind, c.issue_date);
      try {
        const rows = await q<Doc>(
          `insert into ${tbl("documents")} (customer_name, customer_phone, customer_extra, booking_id, issue_date,
              due_date, event_date, items, discount, vat_rate, paid, total, notes, status, kind, number,
              source_id, created_by, created_by_name, approver_id, approver_name, approver_phone, approver_signature)
            values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) returning ${COLS}`,
          [...vals, c.kind, number, data.source_id && /^[0-9a-f-]{36}$/i.test(data.source_id) ? data.source_id : null, me.id, me.display_name,
            ap?.id ?? null, ap?.name ?? "", ap?.phone ?? "", ap?.signature ?? ""],
        );
        return rows[0];
      } catch (e: any) {
        if (!/duplicate key|unique/i.test(String(e?.message))) throw e;
      }
    }
    throw new Error("Could not allocate a document number, please try again");
  });

export const deleteDoc = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    const me = await requireAdmin();
    const rows = await q<{ created_by: string | null }>(
      `select created_by::text as created_by from ${tbl("documents")} where id::text = $1`,
      [data.id],
    );
    if (!rows[0]) return { ok: true };
    if (!me.is_super && rows[0].created_by !== me.id) throw new Error("Only the creator or the general supervisor can delete this");
    await q(`delete from ${tbl("documents")} where id::text = $1`, [data.id]);
    return { ok: true };
  });

/** Supervisors who filled in their contact name — the choices for "approved by". */
export const listApprovers = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./server/session");
  const { q, tbl } = await import("./server/db");
  await requireAdmin();
  return await q<Approver>(
    `select id::text as id, contact_name, contact_phone, signature from ${tbl("admin_users")}
      where contact_name <> '' order by is_super desc, created_at`,
  );
});

/** The signed-in supervisor's own contact details + signature. */
export const getMyContact = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./server/session");
  const { q, tbl } = await import("./server/db");
  const me = await requireAdmin();
  const rows = await q<Approver>(
    `select id::text as id, contact_name, contact_phone, signature from ${tbl("admin_users")} where id::text = $1`,
    [me.id],
  );
  return rows[0];
});

export const saveMyContact = createServerFn({ method: "POST" })
  .inputValidator((d: { contact_name: string; contact_phone: string; signature: string }) => d)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    const me = await requireAdmin();
    const name = String(data.contact_name ?? "").trim().slice(0, 80);
    const phone = String(data.contact_phone ?? "").trim().slice(0, 40);
    const sig = String(data.signature ?? "");
    if (sig && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(sig)) throw new Error("Invalid signature image");
    if (sig.length > 400_000) throw new Error("Signature image is too large");
    await q(
      `update ${tbl("admin_users")} set contact_name=$1, contact_phone=$2, signature=$3, updated_at=now() where id::text = $4`,
      [name, phone, sig, me.id],
    );
    return { ok: true };
  });
