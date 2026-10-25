import { forwardRef } from "react";
import { Instagram } from "lucide-react";
import { OmrSign } from "@/components/site/Currency";
import { WhatsAppIcon } from "@/components/site/BrandLogo";
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

/* Official letterhead (public/brand/letterhead-a4.jpg, same A4 ratio). Its artwork occupies the
   top-right corner (down to y≈250), the bottom-left corner (from y≈920) and a navy band (y≥1065).
   Text is kept out of those zones and the colours come from the artwork. */
export const LETTERHEAD_SRC = "/brand/letterhead-a4.jpg";
const LH = { navy: "#324049", brown: "#805e3b", tan: "#cba075", taupe: "#c0b7b0", soft: "#efe9e2", band: 58 };

/**
 * «الحروف المرسلة»: stretches the last joint of each word with tatweel (ـ), the elongated
 * calligraphic look used for the adhkar on the mosque display. Display only.
 */
const NON_JOINING = new Set([..."اأإآدذرزوؤةءى"]);
function kashida(text: string, count = 3) {
  return text.replace(/[\u0621-\u064A\u064B-\u0652]+/g, (word) => {
    const chars = [...word];
    const letters = chars.map((c, i) => (/[\u0621-\u064A]/.test(c) ? i : -1)).filter((i) => i >= 0);
    if (letters.length < 3) return word;
    // the last joint whose first letter connects forward (لخدمـات، التصويـر)
    for (let k = letters.length - 1; k > 0; k--) {
      const at = letters[k], before = letters[k - 1];
      if (!NON_JOINING.has(chars[before])) return chars.slice(0, at).join("") + "ـ".repeat(count) + chars.slice(at).join("");
    }
    return word;
  });
}

/** Small brand badges used next to the phone and the Instagram handle. */
function WhatsAppBadge() {
  return (
    <span style={{ display: "inline-grid", placeItems: "center", width: 17, height: 17, borderRadius: 999, background: "#25D366", color: "#fff", verticalAlign: "-3px" }}>
      <WhatsAppIcon style={{ width: 11, height: 11 }} />
    </span>
  );
}
function InstagramBadge() {
  return (
    <span style={{ display: "inline-grid", placeItems: "center", width: 17, height: 17, borderRadius: 5, background: "linear-gradient(45deg,#f09433,#dc2743 55%,#bc1888)", color: "#fff", verticalAlign: "-3px" }}>
      <Instagram style={{ width: 11, height: 11 }} strokeWidth={2.4} />
    </span>
  );
}

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
    <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.25, gap: 3 }}>
      <span>{ar}</span>
      <span style={{ fontSize: 9.5, letterSpacing: 0.6, color: "inherit", opacity: 0.65, textTransform: "uppercase", lineHeight: 1.1 }}>{en}</span>
    </span>
  );
}

export const DocPage = forwardRef<HTMLDivElement, { doc: Doc; settings: SiteSettings }>(function DocPage({ doc, settings }, ref) {
  const theme = THEMES.find((t) => t.id === settings.theme) ?? THEMES[0];
  const isInvoice = doc.kind === "invoice";
  const lh = isInvoice ? !!settings.invoice_letterhead : !!settings.quote_letterhead;
  const accent = lh ? LH.navy : theme.swatch[0];
  const label = lh ? LH.brown : accent;   // small section labels
  const soft = lh ? LH.soft : `${theme.swatch[1]}55`;
  const tt = docTotals(doc);
  const state = isInvoice ? invoiceState(tt.total, tt.paid) : null;
  const header = (isInvoice ? settings.invoice_header : settings.quote_header) || "";
  const footer = (isInvoice ? settings.invoice_footer : settings.quote_footer) || "";
  const logo = settings.logo_url ? mediaSrc(settings.logo_url) : "/brand/logo-black.png";

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
        fontFamily: '"Thmanyah Arabic", "Cairo Variable", "Cairo", system-ui, sans-serif',
        fontSize: 13,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxSizing: "border-box",
        // keep the last block clear of the navy band at the bottom of the letterhead
        paddingBottom: lh ? LH.band + 26 : 0,
      }}
    >
      {lh && (
        <img src={LETTERHEAD_SRC} alt="" style={{ position: "absolute", top: 0, left: 0, width: PAGE_W, height: PAGE_H, zIndex: 0, pointerEvents: "none" }} />
      )}

      {/* ===== HEADER ===== */}
      {!lh && <div style={{ height: 8, background: `linear-gradient(90deg, ${theme.swatch[0]}, ${theme.swatch[1]})` }} />}
      <div
        style={{
          position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: lh ? 18 : 24,
          // letterhead: the header stays in the free top-left area, clear of the corner artwork
          padding: lh ? "46px 270px 0 48px" : "30px 48px 22px",
          height: lh ? 186 : undefined, boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: lh ? 12 : 16, minWidth: 0 }}>
          <img src={logo} alt="" crossOrigin="anonymous" style={{ height: lh ? 66 : 78, width: "auto", maxWidth: lh ? 110 : 140, objectFit: "contain" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: lh ? 20 : 22, fontWeight: 700, lineHeight: 1.25, color: lh ? LH.navy : undefined }}>{settings.site_name}</div>
            {header && (
              <div style={{ marginTop: 4, whiteSpace: "pre-line", color: lh ? LH.brown : MUTED, fontFamily: '"Thmanyah Serif Text", "Cairo Variable", serif', fontWeight: 500, fontSize: 20, lineHeight: 1.45 }}>
                {kashida(header)}
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: "left", flexShrink: 0 }}>
          <div style={{ fontSize: lh ? 28 : 30, fontWeight: 700, color: lh ? LH.brown : accent, lineHeight: 1.1 }}>{isInvoice ? "فاتورة" : "عرض سعر"}</div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: MUTED, marginTop: 8, lineHeight: 1 }}>{isInvoice ? "INVOICE" : "QUOTATION"}</div>
          <div dir="ltr" style={{ marginTop: 10, display: "inline-block", background: soft, borderRadius: 999, padding: "4px 12px", fontWeight: 700, fontSize: 13 }}>
            {doc.number || (isInvoice ? "INV-—" : "QT-—")}
          </div>
        </div>
      </div>
      {/* separator — on the letterhead it stops before the corner artwork */}
      <div style={{ position: "relative", height: lh ? 2 : 1, background: lh ? `linear-gradient(270deg, ${LH.tan}, ${LH.taupe} 60%, transparent)` : LINE, margin: lh ? "0 150px 0 48px" : "0 48px" }} />

      {/* ===== BODY ===== */}
      <div style={{ position: "relative", padding: lh ? "50px 48px 0" : "22px 48px 0", flex: 1 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
          <div style={{ flex: 1, background: "#f7f7f5", borderRadius: 14, padding: "14px 18px" }}>
            <div style={{ color: label, fontSize: 12, fontWeight: 700 }}>
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
                <div style={{ color: label, fontSize: 12, fontWeight: 700 }}><Label ar="ملاحظات" en="Notes" /></div>
                <div style={{ marginTop: 6, whiteSpace: "pre-line", lineHeight: 1.75 }}>{doc.notes}</div>
              </div>
            )}
            {isInvoice && settings.bank_details && tt.due > 0 && (
              <div style={{ marginTop: doc.notes ? 12 : 0, border: `1px dashed ${accent}`, borderRadius: 14, padding: "12px 16px" }}>
                <div style={{ color: label, fontSize: 12, fontWeight: 700 }}><Label ar="بيانات التحويل" en="Payment details" /></div>
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
        <div style={{ position: "relative", padding: "26px 48px 0" }}>
          <div style={{ color: label, fontSize: 13, fontWeight: 700 }}>للتواصل والاستفسار:</div>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 16, minHeight: 30 }}>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, whiteSpace: "nowrap", color: lh ? LH.navy : undefined }}>{doc.approver_name}</div>
            {doc.approver_signature && (
              <img src={doc.approver_signature} alt="" style={{ height: 58, width: "auto", maxWidth: 200, objectFit: "contain", flexShrink: 0, margin: "-8px 0" }} />
            )}
          </div>
          {/* RTL row: WhatsApp + phone on the right, divider, Instagram + handle on the left */}
          <div dir="rtl" style={{ marginTop: 5, color: MUTED, fontSize: 13, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center" }}>
            {doc.approver_phone && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><WhatsAppBadge /><bdi dir="ltr">{doc.approver_phone}</bdi></span>
            )}
            {doc.approver_phone && settings.quote_contact_link && <span style={{ margin: "0 12px", color: "#b8bdc6" }}>|</span>}
            {settings.quote_contact_link && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><InstagramBadge /><bdi dir="ltr">{settings.quote_contact_link}</bdi></span>
            )}
          </div>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      {lh ? (
        // inside the navy band of the letterhead, right of the corner artwork
        <div style={{ position: "absolute", bottom: 0, left: 300, right: 48, height: LH.band, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, color: "#ffffff", zIndex: 1 }}>
          {footer && <div style={{ textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 12, lineHeight: 1.5 }}>{footer.replace(/\s*\n\s*/g, " · ")}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.75 }}>
            <span>{settings.site_name}</span>
            <span dir="ltr">{doc.number}</span>
          </div>
        </div>
      ) : (
        <>
          <div style={{ padding: "26px 48px 0" }}>
            <div style={{ height: 1, background: LINE }} />
            {footer && <div style={{ textAlign: "center", whiteSpace: "pre-line", padding: "12px 0 2px", fontSize: 12.5, lineHeight: 1.7 }}>{footer}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", color: MUTED, fontSize: 10.5, padding: "8px 0 18px" }}>
              <span>{settings.site_name}</span>
              <span dir="ltr">{doc.number}</span>
            </div>
          </div>
          <div style={{ height: 6, background: `linear-gradient(90deg, ${theme.swatch[1]}, ${theme.swatch[0]})` }} />
        </>
      )}
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
