import { forwardRef } from "react";
import { OmrSign } from "@/components/site/Currency";
import { mediaSrc } from "@/integrations/supabase/client";
import type { SiteSettings } from "@/lib/app-context";
import { THEMES } from "@/lib/themes";
import { docTotals, invoiceState, money, type Doc } from "@/lib/documents";

/** A4 at 96 dpi. The page is always light (it is a paper document), whatever the dashboard theme. */
export const PAGE_W = 794;
export const PAGE_H = 1123;

const INK = "#1b2333";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";
const RED = "#c83e3a";
const GREEN = "#2f8f4e";

const fmtDate = (s: string | null | undefined) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

function Amount({ value, strong, color }: { value: number; strong?: boolean; color?: string }) {
  return (
    <span dir="ltr" style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", fontWeight: strong ? 700 : 500, color }}>
      <OmrSign />
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(value)}</span>
    </span>
  );
}

function Label({ ar, en }: { ar: string; en: string }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.2 }}>
      <span>{ar}</span>
      <span style={{ fontSize: 9.5, letterSpacing: 0.6, color: "inherit", opacity: 0.65, textTransform: "uppercase" }}>{en}</span>
    </span>
  );
}

export const DocPage = forwardRef<HTMLDivElement, { doc: Doc; settings: SiteSettings }>(function DocPage({ doc, settings }, ref) {
  const theme = THEMES.find((t) => t.id === settings.theme) ?? THEMES[0];
  const accent = theme.swatch[0];
  const soft = `${theme.swatch[1]}55`;
  const isInvoice = doc.kind === "invoice";
  const tt = docTotals(doc);
  const state = isInvoice ? invoiceState(tt.total, tt.paid) : null;
  const header = (isInvoice ? settings.invoice_header : settings.quote_header) || "";
  const footer = (isInvoice ? settings.invoice_footer : settings.quote_footer) || "";
  const logo = settings.logo_url ? mediaSrc(settings.logo_url) : "/brand/logo-black.png";
  const contact = [settings.whatsapp_number, settings.instagram_url?.replace(/^https?:\/\/(www\.)?/, "")].filter(Boolean);

  const metaRows: [string, string, string][] = [
    ["تاريخ الإصدار", "Issue date", fmtDate(doc.issue_date)],
    ...(doc.due_date ? [[isInvoice ? "تاريخ الاستحقاق" : "صالح حتى", isInvoice ? "Due date" : "Valid until", fmtDate(doc.due_date)] as [string, string, string]] : []),
    ...(doc.event_date ? [["تاريخ المناسبة", "Event date", fmtDate(doc.event_date)] as [string, string, string]] : []),
  ];

  return (
    <div
      ref={ref}
      dir="rtl"
      lang="ar"
      style={{
        width: PAGE_W,
        minHeight: PAGE_H,
        background: "#ffffff",
        color: INK,
        fontFamily: '"IBM Plex Sans Arabic", system-ui, sans-serif',
        fontSize: 13,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* ===== HEADER ===== */}
      <div style={{ height: 8, background: `linear-gradient(90deg, ${theme.swatch[0]}, ${theme.swatch[1]})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, padding: "30px 48px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
          <img src={logo} alt="" crossOrigin="anonymous" style={{ height: 78, width: "auto", maxWidth: 140, objectFit: "contain" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.25 }}>{settings.site_name}</div>
            {header && <div style={{ marginTop: 4, whiteSpace: "pre-line", color: MUTED, fontSize: 12, lineHeight: 1.6 }}>{header}</div>}
            {contact.length > 0 && (
              <div dir="ltr" style={{ marginTop: 4, color: MUTED, fontSize: 12, textAlign: "right" }}>{contact.join("  ·  ")}</div>
            )}
          </div>
        </div>
        <div style={{ textAlign: "left", flexShrink: 0 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: accent, lineHeight: 1.1 }}>{isInvoice ? "فاتورة" : "عرض سعر"}</div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: MUTED, marginTop: 2 }}>{isInvoice ? "INVOICE" : "QUOTATION"}</div>
          <div dir="ltr" style={{ marginTop: 10, display: "inline-block", background: soft, borderRadius: 999, padding: "4px 12px", fontWeight: 700, fontSize: 13 }}>
            {doc.number || (isInvoice ? "INV-—" : "QT-—")}
          </div>
        </div>
      </div>
      <div style={{ height: 1, background: LINE, margin: "0 48px" }} />

      {/* ===== BODY ===== */}
      <div style={{ padding: "22px 48px 0", flex: 1 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
          <div style={{ flex: 1, background: "#f7f7f5", borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ color: accent, fontSize: 12, fontWeight: 700 }}>
              <Label ar={isInvoice ? "فاتورة إلى" : "مقدَّم إلى"} en={isInvoice ? "Bill to" : "Prepared for"} />
            </div>
            <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700 }}>{doc.customer_name || "—"}</div>
            {doc.customer_phone && <div dir="ltr" style={{ color: MUTED, marginTop: 2, textAlign: "right" }}>{doc.customer_phone}</div>}
            {doc.customer_extra && <div style={{ color: MUTED, marginTop: 2, whiteSpace: "pre-line" }}>{doc.customer_extra}</div>}
          </div>
          <div style={{ width: 250, borderRadius: 14, border: `1px solid ${LINE}`, padding: "10px 16px" }}>
            {metaRows.map(([a, e, v], i) => (
              <div key={a} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: i ? `1px solid ${LINE}` : "none" }}>
                <span style={{ color: MUTED, fontSize: 12 }}><Label ar={a} en={e} /></span>
                <span dir="ltr" style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* items */}
        <table style={{ width: "100%", marginTop: 22, borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
          <thead>
            <tr style={{ background: accent, color: "#fff" }}>
              {[
                ["#", "", 36, "center"],
                ["الوصف", "Description", undefined, "right"],
                ["الكمية", "Qty", 70, "center"],
                ["سعر الوحدة", "Unit price", 120, "center"],
                ["المجموع", "Amount", 130, "center"],
              ].map(([a, e, w, al], i, arr) => (
                <th
                  key={i}
                  style={{
                    width: w as number | undefined,
                    textAlign: al as "center" | "right",
                    padding: "9px 12px",
                    fontWeight: 600,
                    fontSize: 12,
                    borderTopRightRadius: i === 0 ? 10 : 0,
                    borderBottomRightRadius: i === 0 ? 10 : 0,
                    borderTopLeftRadius: i === arr.length - 1 ? 10 : 0,
                    borderBottomLeftRadius: i === arr.length - 1 ? 10 : 0,
                  }}
                >
                  {e ? <Label ar={a as string} en={e as string} /> : a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doc.items.map((it, i) => (
              <tr key={i}>
                <td style={{ textAlign: "center", padding: "11px 12px", borderBottom: `1px solid ${LINE}`, color: MUTED }}>{i + 1}</td>
                <td style={{ padding: "11px 12px", borderBottom: `1px solid ${LINE}`, whiteSpace: "pre-line", fontWeight: 500 }}>{it.desc}</td>
                <td style={{ textAlign: "center", padding: "11px 12px", borderBottom: `1px solid ${LINE}` }} dir="ltr">{money(it.qty)}</td>
                <td style={{ textAlign: "center", padding: "11px 12px", borderBottom: `1px solid ${LINE}` }}><Amount value={it.price} /></td>
                <td style={{ textAlign: "center", padding: "11px 12px", borderBottom: `1px solid ${LINE}` }}><Amount value={(Number(it.qty) || 0) * (Number(it.price) || 0)} strong /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals + notes */}
        <div style={{ display: "flex", gap: 24, marginTop: 20, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {doc.notes && (
              <div style={{ background: "#f7f7f5", borderRadius: 14, padding: "12px 16px" }}>
                <div style={{ color: accent, fontSize: 12, fontWeight: 700 }}><Label ar="ملاحظات" en="Notes" /></div>
                <div style={{ marginTop: 6, whiteSpace: "pre-line", lineHeight: 1.75 }}>{doc.notes}</div>
              </div>
            )}
            {isInvoice && settings.bank_details && tt.due > 0 && (
              <div style={{ marginTop: doc.notes ? 12 : 0, border: `1px dashed ${accent}`, borderRadius: 14, padding: "12px 16px" }}>
                <div style={{ color: accent, fontSize: 12, fontWeight: 700 }}><Label ar="بيانات التحويل" en="Payment details" /></div>
                <div style={{ marginTop: 6, whiteSpace: "pre-line", lineHeight: 1.75 }}>{settings.bank_details}</div>
              </div>
            )}
          </div>
          <div style={{ width: 290, flexShrink: 0 }}>
            <TotalRow ar="المجموع الفرعي" en="Subtotal" value={tt.subtotal} />
            {tt.discount > 0 && <TotalRow ar="الخصم" en="Discount" value={-tt.discount} color={RED} />}
            {tt.vat > 0 && <TotalRow ar={`ضريبة القيمة المضافة ${money(doc.vat_rate)}٪`} en="VAT" value={tt.vat} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, background: accent, color: "#fff", borderRadius: 12, padding: "11px 14px", fontSize: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}><Label ar="الإجمالي" en="Total" /></span>
              <Amount value={tt.total} strong />
            </div>
            {isInvoice && tt.paid > 0 && (
              <>
                <TotalRow ar="المدفوع" en="Paid" value={tt.paid} color={GREEN} />
                <TotalRow ar="المتبقي" en="Balance due" value={tt.due} color={tt.due > 0 ? RED : GREEN} strong />
              </>
            )}
          </div>
        </div>

        {state === "paid" && (
          <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-start" }}>
            <span style={{ border: `2px solid ${GREEN}`, color: GREEN, borderRadius: 10, padding: "4px 16px", fontWeight: 700, fontSize: 15, transform: "rotate(-4deg)" }}>
              مدفوعة بالكامل · PAID
            </span>
          </div>
        )}
      </div>

      {/* ===== QUOTATION CONTACT + SIGNATURE (signature sits beside the name, on its left) ===== */}
      {!isInvoice && doc.approver_name && (
        <div style={{ padding: "26px 48px 0" }}>
          <div style={{ color: accent, fontSize: 13, fontWeight: 700 }}>للتواصل والاستفسار:</div>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 16, minHeight: 30 }}>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, whiteSpace: "nowrap" }}>{doc.approver_name}</div>
            {doc.approver_signature && (
              <img src={doc.approver_signature} alt="" style={{ height: 58, width: "auto", maxWidth: 200, objectFit: "contain", flexShrink: 0, margin: "-8px 0" }} />
            )}
          </div>
          {/* RTL row: phone on the right, then the divider, then the link on the left */}
          <div dir="rtl" style={{ marginTop: 4, color: MUTED, fontSize: 13, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
            {[doc.approver_phone, settings.quote_contact_link].filter(Boolean).map((x, i) => (
              <span key={i}>
                {i > 0 && <span style={{ margin: "0 12px", color: "#b8bdc6" }}>|</span>}
                <bdi dir="ltr">{x}</bdi>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div style={{ padding: "26px 48px 0" }}>
        <div style={{ height: 1, background: LINE }} />
        {footer && <div style={{ textAlign: "center", whiteSpace: "pre-line", padding: "12px 0 2px", fontSize: 12.5, lineHeight: 1.7 }}>{footer}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", color: MUTED, fontSize: 10.5, padding: "8px 0 18px" }}>
          <span>{settings.site_name}</span>
          <span dir="ltr">{doc.number}</span>
        </div>
      </div>
      <div style={{ height: 6, background: `linear-gradient(90deg, ${theme.swatch[1]}, ${theme.swatch[0]})` }} />
    </div>
  );
});

function TotalRow({ ar, en, value, color, strong }: { ar: string; en: string; value: number; color?: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: `1px solid ${LINE}` }}>
      <span style={{ color: MUTED, fontSize: 12 }}><Label ar={ar} en={en} /></span>
      <Amount value={value} color={color} strong={strong} />
    </div>
  );
}
