import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, ChevronLeft, ChevronRight, FileText, Loader2, PanelsTopLeft, Pencil, Plus, Search, Share2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang, useSettings } from "@/lib/app-context";
import { SegmentedControl } from "@/components/ui/segmented";
import { IosSheet, FormGroup, FormRow, fieldCls } from "@/components/admin/IosSheet";
import { Currency } from "@/components/site/Currency";
import { DocPage, PAGE_W } from "@/components/admin/docs/DocPage";
import { PdfIcon, PrintIcon } from "@/components/admin/docs/FileIcons";
import { downloadBlob, makePdf, printNode, sharePdf } from "@/components/admin/docs/pdf";
import { deleteDoc, listApprovers, listDocs, saveDoc } from "@/lib/docs.functions";
import { docTotals, emptyDoc, invoiceState, money, todayKey, type Approver, type Doc, type DocKind } from "@/lib/documents";
import { cn } from "@/lib/utils";

type Row = Doc & { id: string; number: string; total: number; created_by?: string | null };

export function DocsTab({ isSuper, myId }: { isSuper: boolean; myId: string }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const [kind, setKind] = useState<DocKind>("invoice");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Doc | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [designOpen, setDesignOpen] = useState(false);
  const Chevron = ar ? ChevronLeft : ChevronRight;

  const invoices = useQuery({ queryKey: ["docs", "invoice"], queryFn: () => listDocs({ data: { kind: "invoice" } }) as Promise<Row[]> });
  const quotes = useQuery({ queryKey: ["docs", "quote"], queryFn: () => listDocs({ data: { kind: "quote" } }) as Promise<Row[]> });
  const current = kind === "invoice" ? invoices : quotes;
  const rows = current.data ?? [];

  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.customer_name.toLowerCase().includes(s) || r.number.toLowerCase().includes(s) || r.customer_phone.replace(/\s/g, "").includes(s.replace(/\s/g, "")));
  }, [rows, search]);

  const outstanding = useMemo(
    () => (invoices.data ?? []).reduce((sum, r) => sum + Math.max(0, r.total - r.paid), 0),
    [invoices.data],
  );

  const refresh = () => qc.invalidateQueries({ queryKey: ["docs"] });
  const isInvoice = kind === "invoice";

  return (
    <div className="space-y-4">
      <SegmentedControl
        value={kind}
        onChange={(v) => { setKind(v); setSearch(""); }}
        size="sm"
        options={[
          { value: "invoice", label: ar ? "الفواتير" : "Invoices", badge: <span className="text-[11px] font-bold opacity-60">{invoices.data?.length ?? 0}</span> },
          { value: "quote", label: ar ? "عروض الأسعار" : "Quotations", badge: <span className="text-[11px] font-bold opacity-60">{quotes.data?.length ?? 0}</span> },
        ]}
      />

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setEditing(emptyDoc(kind))} className="tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground">
          <Plus className="h-4 w-4" /> {isInvoice ? (ar ? "فاتورة جديدة" : "New invoice") : ar ? "عرض سعر جديد" : "New quote"}
        </button>
        <button type="button" onClick={() => setDesignOpen(true)} className="tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-fill px-3.5 text-sm font-bold" title={ar ? "الرأس والتذييل" : "Header & footer"}>
          <PanelsTopLeft className="h-4 w-4" /> <span className="hidden sm:inline">{ar ? "الرأس والتذييل" : "Header & footer"}</span>
        </button>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} type="search" placeholder={ar ? "بحث" : "Search"} className="h-10 w-full rounded-xl bg-fill pe-3 ps-9 text-[15px] outline-none placeholder:text-muted-foreground" />
        </div>
      </div>

      {isInvoice && outstanding > 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-ios-red/10 px-4 py-2.5 text-sm font-semibold text-ios-red">
          <span>{ar ? "مبالغ متبقية غير محصَّلة" : "Outstanding balance"}</span>
          <span dir="ltr" className="inline-flex items-center gap-1 font-bold"><Currency />{money(outstanding)}</span>
        </div>
      )}

      {current.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-fill" />
      ) : list.length === 0 ? (
        <div className="ios-card flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
          <FileText className="h-8 w-8 opacity-40" />
          {rows.length === 0 ? (isInvoice ? (ar ? "لا توجد فواتير بعد" : "No invoices yet") : ar ? "لا توجد عروض أسعار بعد" : "No quotations yet") : ar ? "لا توجد نتائج" : "No results"}
        </div>
      ) : (
        <div className="ios-group ios-divide">
          {list.map((r) => (
            <button key={r.id} type="button" onClick={() => setViewing(r)} className="ios-row tap w-full text-start">
              <span className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-fill sm:grid"><FileText className="h-5 w-5 text-muted-foreground" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{r.customer_name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
                  <span dir="ltr" className="whitespace-nowrap font-semibold">{r.number}</span>
                  <StatusPill row={r} ar={ar} />
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span dir="ltr" className="inline-flex items-center gap-1 whitespace-nowrap text-[15px] font-bold">
                  <Currency className="text-muted-foreground" />{money(r.total)}
                </span>
                <span dir="ltr" className="text-[11.5px] text-muted-foreground">{r.issue_date.split("-").reverse().join("/")}</span>
              </span>
              <Chevron className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            </button>
          ))}
        </div>
      )}

      <DocEditor
        doc={editing}
        myId={myId}
        onClose={() => setEditing(null)}
        onSaved={(row) => { setEditing(null); refresh(); setViewing(row); }}
      />
      <DocViewer
        row={viewing}
        canDelete={!!viewing && (isSuper || viewing.created_by === myId)}
        onClose={() => setViewing(null)}
        onEdit={(d) => { setViewing(null); setEditing(d); }}
        onChanged={(row) => { refresh(); setViewing(row); }}
        onDeleted={() => { setViewing(null); refresh(); }}
        onConverted={(inv) => { refresh(); setKind("invoice"); setViewing(inv); }}
      />
      <DesignSheet open={designOpen} onOpenChange={setDesignOpen} initialKind={kind} />
    </div>
  );
}

/* ---------------- status ---------------- */
function StatusPill({ row, ar }: { row: Row; ar: boolean }) {
  let cls = "bg-fill text-muted-foreground", label = "";
  if (row.kind === "invoice") {
    const s = invoiceState(row.total, row.paid);
    if (s === "paid") { cls = "bg-ios-green/15 text-ios-green"; label = ar ? "مدفوعة" : "Paid"; }
    else if (s === "partial") { cls = "bg-ios-orange/15 text-ios-orange"; label = ar ? "مدفوعة جزئياً" : "Partly paid"; }
    else { cls = "bg-ios-red/12 text-ios-red"; label = ar ? "غير مدفوعة" : "Unpaid"; }
  } else {
    const expired = row.status === "open" && row.due_date && row.due_date < todayKey();
    if (row.status === "accepted") { cls = "bg-ios-green/15 text-ios-green"; label = ar ? "مقبول" : "Accepted"; }
    else if (row.status === "rejected") { cls = "bg-ios-red/12 text-ios-red"; label = ar ? "مرفوض" : "Rejected"; }
    else if (expired) { label = ar ? "منتهي" : "Expired"; }
    else { cls = "bg-ios-blue/12 text-ios-blue"; label = ar ? "بانتظار الرد" : "Awaiting reply"; }
  }
  return <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-px text-[10.5px] font-bold", cls)}>{label}</span>;
}

/* ---------------- scaled live preview of the A4 page ---------------- */
function ScaledPage({ doc, pageRef }: { doc: Doc; pageRef?: React.Ref<HTMLDivElement> }) {
  const { settings } = useSettings();
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const s = Math.min(1, el.clientWidth / PAGE_W);
      setScale(s);
      setH((inner.current?.offsetHeight ?? 1123) * s);
    });
    ro.observe(el);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} dir="ltr" className="w-full overflow-hidden rounded-xl bg-white shadow-[0_6px_24px_-10px_rgba(0,0,0,.35)] ring-1 ring-black/5" style={{ height: h || undefined }}>
      <div ref={inner} style={{ width: PAGE_W, transform: `scale(${scale})`, transformOrigin: "top left" }} dir="ltr">
        <DocPage ref={pageRef} doc={doc} settings={settings} />
      </div>
    </div>
  );
}

/* ---------------- viewer ---------------- */
function DocViewer({
  row, canDelete, onClose, onEdit, onChanged, onDeleted, onConverted,
}: {
  row: Row | null;
  canDelete: boolean;
  onClose: () => void;
  onEdit: (d: Doc) => void;
  onChanged: (r: Row) => void;
  onDeleted: () => void;
  onConverted: (r: Row) => void;
}) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const page = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const isInvoice = row?.kind === "invoice";
  const filename = row ? `${row.number}.pdf` : "document.pdf";
  const title = row ? `${isInvoice ? (ar ? "فاتورة" : "Invoice") : ar ? "عرض سعر" : "Quotation"} ${row.number}` : "";

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e: any) { toast.error(e?.message ?? String(e)); } finally { setBusy(null); }
  };

  // Build the PDF in the background as soon as the document is shown, so "Share" can open
  // the share sheet directly from the tap (a slow render before share() = "Permission denied").
  const pdf = useRef<{ key: string; promise: Promise<Blob>; blob: Blob | null } | null>(null);
  const pdfKey = row ? JSON.stringify(row) : "";
  const getPdf = () => {
    if (pdf.current?.key !== pdfKey) {
      const entry = { key: pdfKey, promise: makePdf(page.current!), blob: null as Blob | null };
      entry.promise.then((b) => { entry.blob = b; }).catch(() => { if (pdf.current === entry) pdf.current = null; });
      pdf.current = entry;
    }
    return pdf.current!;
  };
  useEffect(() => {
    if (!row) return;
    const t = setTimeout(() => { if (page.current) getPdf().promise.catch(() => {}); }, 900);
    return () => clearTimeout(t);
  }, [pdfKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = () => run("pdf", async () => {
    downloadBlob(await getPdf().promise, filename);
    toast.success(ar ? "تم تحميل ملف PDF" : "PDF downloaded");
  });

  // When the file wasn't ready at the tap, the Share button turns into "tap to share":
  // the browser only opens the share sheet straight from a tap.
  const [tapToShare, setTapToShare] = useState(false);
  useEffect(() => setTapToShare(false), [pdfKey]);

  const shareBlob = async (blob: Blob, secondTry: boolean) => {
    const r = await sharePdf(blob, filename);
    if (r.status === "ok") { setTapToShare(false); return; }
    if (r.status === "blocked" && !secondTry) { setTapToShare(true); return; } // one fresh tap, then fall back
    // This browser won't open the share sheet: give the file so it can be shared from Files/Downloads.
    setTapToShare(false);
    downloadBlob(blob, filename);
    toast.message(
      ar ? "تعذّر فتح نافذة المشاركة في هذا المتصفح، فتم تحميل الملف. شاركه من التنزيلات أو الملفات." : "This browser wouldn't open the share sheet, so the file was downloaded. Share it from Downloads/Files.",
      { description: r.detail, duration: 12000 },
    );
  };

  const share = () => {
    const ready = pdf.current?.key === pdfKey ? pdf.current.blob : null;
    if (ready) { shareBlob(ready, tapToShare).catch((e) => toast.error(e?.message ?? String(e))); return; }
    run("share", async () => { await getPdf().promise; setTapToShare(true); });
  };
  const print = () => run("print", () => printNode(page.current!));

  const setStatus = (status: string) => run("status", async () => {
    if (!row) return;
    onChanged((await saveDoc({ data: { ...row, status } })) as Row);
  });

  const convert = () => run("convert", async () => {
    if (!row) return;
    const inv = (await saveDoc({ data: { ...row, id: undefined, number: undefined, kind: "invoice", source_id: row.id, issue_date: todayKey(), due_date: null, paid: 0, status: "open" } })) as Row;
    if (row.status !== "accepted") await saveDoc({ data: { ...row, status: "accepted" } });
    toast.success(ar ? `تم إنشاء الفاتورة ${inv.number}` : `Invoice ${inv.number} created`);
    onConverted(inv);
  });

  const remove = () => {
    if (!row || !confirm(ar ? `حذف ${row.number} نهائياً؟` : `Delete ${row.number} permanently?`)) return;
    run("delete", async () => { await deleteDoc({ data: { id: row.id } }); onDeleted(); });
  };

  const Action = ({ k, onClick, icon, label, tone }: { k: string; onClick: () => void; icon: React.ReactNode; label: string; tone?: string }) => (
    <button type="button" data-vaul-no-drag onClick={onClick} disabled={!!busy} className={cn("tap flex flex-col items-center gap-1 rounded-2xl bg-fill px-2 py-2.5 text-[12px] font-bold disabled:opacity-60", tone)}>
      {busy === k ? <Loader2 className="h-6 w-6 animate-spin" /> : icon}
      {label}
    </button>
  );

  return (
    <IosSheet open={!!row} onOpenChange={(v) => !v && onClose()} title={title}>
      {row && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <Action k="pdf" onClick={download} icon={<PdfIcon className="h-6 w-6" />} label={ar ? "تحميل PDF" : "PDF"} />
            <Action k="print" onClick={print} icon={<PrintIcon className="h-6 w-6" />} label={ar ? "طباعة" : "Print"} />
            <Action
              k="share"
              onClick={share}
              icon={<Share2 className={cn("h-6 w-6", tapToShare ? "text-white" : "text-ios-blue")} />}
              label={tapToShare ? (ar ? "اضغط للمشاركة" : "Tap to share") : ar ? "مشاركة" : "Share"}
              tone={tapToShare ? "bg-ios-blue text-white animate-pulse" : undefined}
            />
            <Action k="edit" onClick={() => onEdit(row)} icon={<Pencil className="h-6 w-6" />} label={ar ? "تعديل" : "Edit"} />
          </div>

          {!isInvoice && (
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                className="min-w-0 flex-1"
                size="sm"
                value={row.status as string}
                onChange={(v) => setStatus(v)}
                options={[
                  { value: "open", label: ar ? "بانتظار الرد" : "Awaiting" },
                  { value: "accepted", label: ar ? "مقبول" : "Accepted" },
                  { value: "rejected", label: ar ? "مرفوض" : "Rejected" },
                ]}
              />
              <button type="button" onClick={convert} disabled={!!busy} className="tap inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-bold text-primary-foreground disabled:opacity-60">
                {busy === "convert" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                {ar ? "تحويل إلى فاتورة" : "Convert to invoice"}
              </button>
            </div>
          )}

          <ScaledPage doc={row} pageRef={page} />

          <p className="text-center text-xs text-muted-foreground">
            {ar ? `أنشأه ${row.created_by_name || "—"}` : `Created by ${row.created_by_name || "—"}`}
          </p>
          {canDelete && (
            <button type="button" onClick={remove} disabled={!!busy} className="tap flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-ios-red/10 text-[15px] font-semibold text-ios-red">
              {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {ar ? "حذف" : "Delete"}
            </button>
          )}
        </div>
      )}
    </IosSheet>
  );
}

/* ---------------- editor ---------------- */
function DocEditor({ doc, myId, onClose, onSaved }: { doc: Doc | null; myId: string; onClose: () => void; onSaved: (r: Row) => void }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const [d, setD] = useState<Doc | null>(doc);
  const [saving, setSaving] = useState(false);

  const { data: approvers = [], isFetched: approversReady } = useQuery({
    queryKey: ["approvers"],
    queryFn: () => listApprovers() as Promise<Approver[]>,
    enabled: !!doc && doc.kind === "quote",
  });

  useEffect(() => setD(doc ? structuredClone(doc) : null), [doc]);

  // New quotation: approved by me by default, when my details are filled in.
  useEffect(() => {
    if (!doc || doc.kind !== "quote" || doc.id || !approversReady) return;
    const mine = approvers.find((a) => a.id === myId);
    if (mine) setD((x) => (x && !x.id && x.approver_id == null ? withApprover(x, mine) : x));
  }, [doc, approversReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: bookings = [] } = useQuery({
    queryKey: ["admin_bookings"],
    queryFn: async () => (await supabase.from("bookings").select("*, packages(name_ar, name_en, price, currency)").order("created_at", { ascending: false })).data ?? [],
    enabled: !!doc,
  });

  if (!d) return <IosSheet open={false} onOpenChange={() => {}} title=""><span /></IosSheet>;
  const isInvoice = d.kind === "invoice";
  const set = (patch: Partial<Doc>) => setD((x) => (x ? { ...x, ...patch } : x));
  const setItem = (i: number, patch: Partial<Doc["items"][number]>) => set({ items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const tt = docTotals(d);

  const fromBooking = (id: string) => {
    const b: any = bookings.find((x: any) => x.id === id);
    if (!b) return set({ booking_id: null });
    const p = b.packages;
    set({
      booking_id: b.id,
      customer_name: b.customer_name,
      customer_phone: b.phone ?? "",
      event_date: b.event_date,
      items: p ? [{ desc: `${p.name_ar}${b.event_time ? ` — ${ar ? "الساعة" : "at"} ${String(b.event_time).slice(0, 5)}` : ""}`, qty: 1, price: Number(p.price) || 0 }] : d.items,
    });
  };

  const save = async () => {
    if (d.customer_name.trim().length < 2) return toast.error(ar ? "اكتب اسم العميل" : "Enter the customer name");
    if (!d.items.some((i) => i.desc.trim() || Number(i.price))) return toast.error(ar ? "أضف بنداً واحداً على الأقل" : "Add at least one item");
    setSaving(true);
    try {
      const row = (await saveDoc({ data: d })) as Row;
      toast.success(d.id ? (ar ? "تم الحفظ" : "Saved") : ar ? `تم إنشاء ${row.number}` : `${row.number} created`);
      onSaved(row);
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const numCls = cn(fieldCls, "text-end");
  return (
    <IosSheet
      open={!!doc}
      onOpenChange={(v) => !v && onClose()}
      title={d.id ? `${ar ? "تعديل" : "Edit"} ${d.number}` : isInvoice ? (ar ? "فاتورة جديدة" : "New invoice") : ar ? "عرض سعر جديد" : "New quotation"}
      onSave={save}
      saving={saving}
    >
      <FormGroup label={ar ? "من حجز (اختياري)" : "From a booking (optional)"} footer={ar ? "يملأ بيانات العميل والباقة تلقائياً." : "Fills in the client and package automatically."}>
        <div className="px-4 py-2">
          <select className={cn(fieldCls, "cursor-pointer")} value={d.booking_id ?? ""} onChange={(e) => fromBooking(e.target.value)}>
            <option value="">{ar ? "— بدون —" : "— None —"}</option>
            {bookings.filter((b: any) => b.status !== "cancelled").map((b: any) => (
              <option key={b.id} value={b.id}>{b.customer_name} · {b.event_date}{b.packages ? ` · ${b.packages.name_ar}` : ""}</option>
            ))}
          </select>
        </div>
      </FormGroup>

      <FormGroup label={ar ? "العميل" : "Client"}>
        <FormRow label={ar ? "الاسم" : "Name"}><input className={fieldCls} value={d.customer_name} onChange={(e) => set({ customer_name: e.target.value })} placeholder={ar ? "اسم العميل" : "Client name"} /></FormRow>
        <FormRow label={ar ? "الهاتف" : "Phone"}><input className={fieldCls} dir="ltr" type="tel" inputMode="tel" value={d.customer_phone} onChange={(e) => set({ customer_phone: e.target.value })} placeholder="+968 9xxx xxxx" /></FormRow>
        <FormRow label={ar ? "بيانات إضافية" : "Extra"}><input className={fieldCls} value={d.customer_extra} onChange={(e) => set({ customer_extra: e.target.value })} placeholder={ar ? "العنوان أو البريد (اختياري)" : "Address or email (optional)"} /></FormRow>
      </FormGroup>

      <FormGroup label={ar ? "التواريخ" : "Dates"}>
        <FormRow label={ar ? "تاريخ الإصدار" : "Issue date"}><input className={fieldCls} type="date" dir="ltr" value={d.issue_date} onChange={(e) => set({ issue_date: e.target.value || todayKey() })} /></FormRow>
        <FormRow label={isInvoice ? (ar ? "تاريخ الاستحقاق" : "Due date") : ar ? "صالح حتى" : "Valid until"}><input className={fieldCls} type="date" dir="ltr" value={d.due_date ?? ""} onChange={(e) => set({ due_date: e.target.value || null })} /></FormRow>
        <FormRow label={ar ? "تاريخ المناسبة" : "Event date"}><input className={fieldCls} type="date" dir="ltr" value={d.event_date ?? ""} onChange={(e) => set({ event_date: e.target.value || null })} /></FormRow>
      </FormGroup>

      <div className="mb-5">
        <div className="section-label">{ar ? "البنود" : "Items"}</div>
        <div className="space-y-2">
          {d.items.map((it, i) => (
            <div key={i} className="ios-group p-3">
              <div className="flex items-start gap-2">
                <span className="mt-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fill text-[12px] font-bold">{i + 1}</span>
                <textarea rows={1} className={cn(fieldCls, "min-h-[34px] flex-1 resize-none rounded-lg bg-fill px-2.5 py-1.5")} value={it.desc} onChange={(e) => setItem(i, { desc: e.target.value })} placeholder={ar ? "وصف البند، مثال: تصوير حفل زفاف ٤ ساعات" : "Item description"} />
                {d.items.length > 1 && (
                  <button type="button" onClick={() => set({ items: d.items.filter((_, j) => j !== i) })} className="tap mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ios-red/10 text-ios-red" aria-label={ar ? "حذف البند" : "Remove item"}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-[1fr_1.4fr_1.4fr] items-center gap-2 ps-8 text-[13px]">
                <label className="flex items-center gap-1.5 rounded-lg bg-fill px-2.5 py-1">
                  <span className="text-muted-foreground">{ar ? "الكمية" : "Qty"}</span>
                  <input className={numCls} type="number" inputMode="decimal" min={0} dir="ltr" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value === "" ? 0 : Number(e.target.value) })} />
                </label>
                <label className="flex items-center gap-1.5 rounded-lg bg-fill px-2.5 py-1">
                  <span className="whitespace-nowrap text-muted-foreground">{ar ? "السعر" : "Price"}</span>
                  <input className={numCls} type="number" inputMode="decimal" min={0} step="0.001" dir="ltr" value={it.price || ""} placeholder="0" onChange={(e) => setItem(i, { price: Number(e.target.value) || 0 })} />
                </label>
                <span dir="ltr" className="inline-flex items-center justify-end gap-1 font-bold"><Currency className="text-muted-foreground" />{money((Number(it.qty) || 0) * (Number(it.price) || 0))}</span>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => set({ items: [...d.items, { desc: "", qty: 1, price: 0 }] })} className="tap mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-fill px-4 text-sm font-bold text-ios-blue">
          <Plus className="h-4 w-4" /> {ar ? "إضافة بند" : "Add item"}
        </button>
      </div>

      <FormGroup label={ar ? "المبالغ" : "Amounts"}>
        <FormRow label={ar ? "خصم (مبلغ)" : "Discount (amount)"}><input className={fieldCls} type="number" inputMode="decimal" min={0} step="0.001" dir="ltr" value={d.discount || ""} placeholder="0" onChange={(e) => set({ discount: Number(e.target.value) || 0 })} /></FormRow>
        <FormRow label={ar ? "ضريبة القيمة المضافة ٪" : "VAT %"}><input className={fieldCls} type="number" inputMode="decimal" min={0} max={100} dir="ltr" value={d.vat_rate || ""} placeholder={ar ? "0 (بدون ضريبة)" : "0 (none)"} onChange={(e) => set({ vat_rate: Number(e.target.value) || 0 })} /></FormRow>
        {isInvoice && (
          <FormRow label={ar ? "المدفوع (الدفعة المقدمة)" : "Paid (advance)"}><input className={fieldCls} type="number" inputMode="decimal" min={0} step="0.001" dir="ltr" value={d.paid || ""} placeholder="0" onChange={(e) => set({ paid: Number(e.target.value) || 0 })} /></FormRow>
        )}
        <div className="ios-row justify-between bg-fill/60 font-bold">
          <span>{ar ? "الإجمالي" : "Total"}</span>
          <span dir="ltr" className="inline-flex items-center gap-1 text-lg"><Currency className="text-muted-foreground" />{money(tt.total)}</span>
        </div>
        {isInvoice && tt.paid > 0 && (
          <div className={cn("ios-row justify-between text-sm font-bold", tt.due > 0 ? "text-ios-red" : "text-ios-green")}>
            <span>{ar ? "المتبقي" : "Balance due"}</span>
            <span dir="ltr" className="inline-flex items-center gap-1"><Currency />{money(tt.due)}</span>
          </div>
        )}
      </FormGroup>

      {!isInvoice && (
        <FormGroup
          label={ar ? "اعتماد بواسطة" : "Approved by"}
          footer={approvers.length === 0
            ? (ar ? "لا توجد أسماء بعد. يضيف كل مشرف اسمه ورقمه وتوقيعه من الإعدادات ← بياناتي في عروض الأسعار." : "No names yet. Each supervisor adds their name, phone and signature in Settings → My details on quotations.")
            : (ar ? "يظهر الاسم ورقم الهاتف والتوقيع في نهاية عرض السعر." : "The name, phone and signature appear at the end of the quotation.")}
        >
          <div className="px-4 py-2">
            <select
              className={cn(fieldCls, "cursor-pointer")}
              value={d.approver_id ?? ""}
              onChange={(e) => {
                const a = approvers.find((x) => x.id === e.target.value);
                set(a ? withApprover(d, a) : { approver_id: null, approver_name: "", approver_phone: "", approver_signature: "" });
              }}
            >
              <option value="">{ar ? "— بدون —" : "— None —"}</option>
              {d.approver_id && !approvers.some((a) => a.id === d.approver_id) && (
                <option value={d.approver_id}>{d.approver_name}</option>
              )}
              {approvers.map((a) => <option key={a.id} value={a.id}>{a.contact_name}</option>)}
            </select>
          </div>
        </FormGroup>
      )}

      <FormGroup label={ar ? "ملاحظات (تظهر في المستند)" : "Notes (shown on the document)"}>
        <div className="px-4 py-2.5">
          <textarea rows={3} className={cn(fieldCls, "resize-none leading-7")} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder={ar ? "مثال: يشمل السعر التعديل والتسليم خلال أسبوعين." : "e.g. Includes editing, delivery within two weeks."} />
        </div>
      </FormGroup>

      <div className="section-label">{ar ? "معاينة" : "Preview"}</div>
      <ScaledPage doc={d} />
    </IosSheet>
  );
}

const withApprover = (d: Doc, a: Approver): Doc => ({
  ...d, approver_id: a.id, approver_name: a.contact_name, approver_phone: a.contact_phone, approver_signature: a.signature,
});

/* ---------------- header & footer design ---------------- */
function DesignSheet({ open, onOpenChange, initialKind }: { open: boolean; onOpenChange: (v: boolean) => void; initialKind: DocKind }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const { settings, refresh } = useSettings();
  const [kind, setKind] = useState<DocKind>(initialKind);
  const [v, setV] = useState({ invoice_header: "", invoice_footer: "", quote_header: "", quote_footer: "", quote_contact_link: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(initialKind);
    setV({ invoice_header: settings.invoice_header, invoice_footer: settings.invoice_footer, quote_header: settings.quote_header, quote_footer: settings.quote_footer, quote_contact_link: settings.quote_contact_link });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const hKey = kind === "invoice" ? "invoice_header" : "quote_header";
  const fKey = kind === "invoice" ? "invoice_footer" : "quote_footer";

  const sample: Doc = {
    ...emptyDoc(kind),
    number: kind === "invoice" ? "INV-2026-001" : "QT-2026-001",
    customer_name: ar ? "أحمد بن سالم البلوشي" : "Ahmed Al Balushi",
    customer_phone: "+968 9123 4567",
    event_date: todayKey(),
    items: [
      { desc: ar ? "باقة الفضية — تغطية ٤ ساعات" : "Silver package — 4h coverage", qty: 1, price: 150 },
      { desc: ar ? "ألبوم مطبوع إضافي" : "Extra printed album", qty: 1, price: 35 },
    ],
    paid: kind === "invoice" ? 50 : 0,
    ...(kind === "quote" ? { approver_id: "sample", approver_name: ar ? "اسم المعتمِد" : "Approver name", approver_phone: "+968 9xxx xxxx", approver_signature: "" } : {}),
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update(v).eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success(ar ? "تم حفظ الرأس والتذييل" : "Header & footer saved");
    onOpenChange(false);
  };

  return (
    <IosSheet open={open} onOpenChange={onOpenChange} title={ar ? "الرأس والتذييل" : "Header & footer"} onSave={save} saving={saving}>
      <SegmentedControl
        className="mb-4"
        size="sm"
        value={kind}
        onChange={setKind}
        options={[{ value: "invoice", label: ar ? "الفاتورة" : "Invoice" }, { value: "quote", label: ar ? "عرض السعر" : "Quotation" }]}
      />
      <FormGroup label={ar ? "الرأس (تحت اسم المنصة)" : "Header (under the site name)"} footer={ar ? "الشعار واسم المنصة ورقم الواتساب تظهر تلقائياً. أضف هنا العنوان أو السجل التجاري مثلاً." : "Logo, site name and WhatsApp are added automatically. Add an address or CR number here."}>
        <div className="px-4 py-2.5">
          <textarea rows={2} className={cn(fieldCls, "resize-none leading-7")} value={v[hKey]} onChange={(e) => setV({ ...v, [hKey]: e.target.value })} placeholder={ar ? "مسقط، سلطنة عُمان · س.ت 1234567" : "Muscat, Sultanate of Oman · CR 1234567"} />
        </div>
      </FormGroup>
      <FormGroup label={ar ? "التذييل (أسفل الصفحة)" : "Footer (bottom of the page)"} footer={kind === "invoice" ? (ar ? "بيانات التحويل من الإعدادات تظهر في الفاتورة تلقائياً عند وجود مبلغ متبقٍ." : "Bank details from Settings are added to invoices automatically when a balance is due.") : undefined}>
        <div className="px-4 py-2.5">
          <textarea rows={3} className={cn(fieldCls, "resize-none leading-7")} value={v[fKey]} onChange={(e) => setV({ ...v, [fKey]: e.target.value })} placeholder={ar ? "شكراً لثقتكم بنا." : "Thank you for your trust."} />
        </div>
      </FormGroup>
      {kind === "quote" && (
        <FormGroup label={ar ? "بجانب رقم الهاتف في «للتواصل والاستفسار»" : "Next to the phone in the contact block"} footer={ar ? "مثال: sevenn.om — الاسم والرقم والتوقيع من «اعتماد بواسطة»." : "e.g. sevenn.om — name, phone and signature come from “Approved by”."}>
          <div className="px-4 py-2.5">
            <input className={fieldCls} dir="ltr" value={v.quote_contact_link} onChange={(e) => setV({ ...v, quote_contact_link: e.target.value })} placeholder="sevenn.om" />
          </div>
        </FormGroup>
      )}
      <div className="section-label">{ar ? "معاينة" : "Preview"}</div>
      <PreviewWithSettings doc={sample} overrides={v} />
    </IosSheet>
  );
}

/** Preview that uses unsaved header/footer text. */
function PreviewWithSettings({ doc, overrides }: { doc: Doc; overrides: Record<string, string> }) {
  const { settings } = useSettings();
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / PAGE_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} dir="ltr" className="w-full overflow-hidden rounded-xl bg-white shadow-[0_6px_24px_-10px_rgba(0,0,0,.35)] ring-1 ring-black/5" style={{ height: 1123 * scale }}>
      <div style={{ width: PAGE_W, transform: `scale(${scale})`, transformOrigin: "top left" }} dir="ltr">
        <DocPage doc={doc} settings={{ ...settings, ...overrides }} />
      </div>
    </div>
  );
}
