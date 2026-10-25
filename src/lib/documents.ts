// Shared (client + server) types and math for invoices & quotations.

export type DocKind = "invoice" | "quote";
export type DocItem = { desc: string; qty: number; price: number };
export type QuoteStatus = "open" | "accepted" | "rejected";

export type Doc = {
  id?: string;
  kind: DocKind;
  number?: string;
  customer_name: string;
  customer_phone: string;
  customer_extra: string;
  booking_id: string | null;
  issue_date: string;          // yyyy-mm-dd
  due_date: string | null;     // invoice: due · quote: valid until
  event_date: string | null;
  items: DocItem[];
  discount: number;
  vat_rate: number;
  paid: number;
  total?: number;
  notes: string;
  status: QuoteStatus | string;
  source_id?: string | null;
  created_by_name?: string;
  created_at?: string;
};

const r3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;

export function docTotals(d: Pick<Doc, "items" | "discount" | "vat_rate" | "paid">) {
  const subtotal = r3(d.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0));
  const discount = Math.min(r3(d.discount), subtotal);
  const afterDiscount = r3(subtotal - discount);
  const vat = r3((afterDiscount * (Number(d.vat_rate) || 0)) / 100);
  const total = r3(afterDiscount + vat);
  const paid = r3(d.paid);
  const due = r3(Math.max(0, total - paid));
  return { subtotal, discount, afterDiscount, vat, total, paid, due };
}

/** Invoice payment state derived from amounts. */
export function invoiceState(total: number, paid: number): "paid" | "partial" | "unpaid" {
  if (total > 0 && paid >= total) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function emptyDoc(kind: DocKind): Doc {
  const valid = new Date();
  valid.setDate(valid.getDate() + 14);
  const v = `${valid.getFullYear()}-${String(valid.getMonth() + 1).padStart(2, "0")}-${String(valid.getDate()).padStart(2, "0")}`;
  return {
    kind,
    customer_name: "",
    customer_phone: "",
    customer_extra: "",
    booking_id: null,
    issue_date: todayKey(),
    due_date: kind === "quote" ? v : null,
    event_date: null,
    items: [{ desc: "", qty: 1, price: 0 }],
    discount: 0,
    vat_rate: 0,
    paid: 0,
    notes: "",
    status: "open",
  };
}

/** Amount text for documents: thousands separators, up to 3 decimals (baisa). */
export function money(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return Number.isInteger(v)
    ? v.toLocaleString("en-US")
    : v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
