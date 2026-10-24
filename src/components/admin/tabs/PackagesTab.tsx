import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Currency } from "@/components/site/Currency";
import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { Switch } from "@/components/ui/switch";
import { IosSheet, FormGroup, FormRow, fieldCls } from "@/components/admin/IosSheet";
import { formatPrice } from "@/components/site/PackagesGrid";
import { cn } from "@/lib/utils";

type Pkg = {
  id?: string; name_ar: string; name_en: string; description_ar: string; description_en: string;
  price: number | string; currency: string; sort_order: number; active: boolean;
  discounted_price: number | string | null; offer_expiry_date: string | null;
};
const empty: Pkg = { name_ar: "", name_en: "", description_ar: "", description_en: "", price: "", currency: "OMR", sort_order: 0, active: true, discounted_price: null, offer_expiry_date: null };

export function PackagesTab() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [saving, setSaving] = useState(false);
  const Chevron = ar ? ChevronLeft : ChevronRight;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin_packages"],
    queryFn: async () => ((await supabase.from("packages").select("*").order("sort_order")).data ?? []) as Pkg[],
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin_packages"] });
    qc.invalidateQueries({ queryKey: ["packages"] });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name_ar.trim()) return toast.error(ar ? "اكتب اسم الباقة" : "Enter the package name");
    if (editing.price === "" || Number(editing.price) < 0) return toast.error(ar ? "اكتب السعر" : "Enter the price");
    setSaving(true);
    const payload = {
      ...editing,
      price: Number(editing.price),
      discounted_price: editing.discounted_price === "" || editing.discounted_price == null ? null : Number(editing.discounted_price),
      sort_order: editing.id ? editing.sort_order : rows.length + 1,
    };
    const { error } = payload.id
      ? await supabase.from("packages").update(payload).eq("id", payload.id)
      : await supabase.from("packages").insert((({ id: _i, ...rest }) => rest)(payload));
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(ar ? "تم الحفظ" : "Saved");
    setEditing(null);
    refresh();
  };

  // Optimistic: flip the switch immediately, save in the background, revert if it fails.
  const toggle = async (p: Pkg, active: boolean) => {
    qc.setQueryData<Pkg[]>(["admin_packages"], (old) => old?.map((x) => (x.id === p.id ? { ...x, active } : x)));
    const { error } = await supabase.from("packages").update({ active }).eq("id", p.id!);
    if (error) {
      qc.setQueryData<Pkg[]>(["admin_packages"], (old) => old?.map((x) => (x.id === p.id ? { ...x, active: !active } : x)));
      return toast.error(error.message);
    }
    toast.success(active ? (ar ? "الباقة ظاهرة للعملاء" : "Package visible") : (ar ? "تم إخفاء الباقة" : "Package hidden"), { duration: 1500 });
    qc.invalidateQueries({ queryKey: ["packages"] });
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[i], b = rows[j];
    await Promise.all([
      supabase.from("packages").update({ sort_order: j + 1 }).eq("id", a.id!),
      supabase.from("packages").update({ sort_order: i + 1 }).eq("id", b.id!),
    ]);
    refresh();
  };

  const remove = async () => {
    if (!editing?.id) return;
    if (!confirm(ar ? `حذف باقة «${editing.name_ar}»؟` : `Delete “${editing.name_en || editing.name_ar}”?`)) return;
    const { error } = await supabase.from("packages").delete().eq("id", editing.id);
    if (error) return toast.error(error.message);
    setEditing(null);
    refresh();
  };

  const set = (patch: Partial<Pkg>) => setEditing((e) => (e ? { ...e, ...patch } : e));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="px-1 text-sm text-muted-foreground">{ar ? "اضغط على الباقة لتعديلها" : "Tap a package to edit it"}</p>
        <button type="button" onClick={() => setEditing({ ...empty })} className="tap inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground">
          <Plus className="h-4 w-4" /> {ar ? "باقة جديدة" : "New package"}
        </button>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-fill" />
      ) : (
        <div className="ios-group ios-divide">
          {rows.length === 0 && <div className="ios-row text-sm text-muted-foreground">{ar ? "لا توجد باقات" : "No packages"}</div>}
          {rows.map((p, i) => {
            const offer = p.discounted_price != null && (!p.offer_expiry_date || new Date(p.offer_expiry_date) > new Date());
            return (
              <div key={p.id} className={cn("ios-row", !p.active && "opacity-55")}>
                <div className="flex flex-col">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="tap p-0.5 text-muted-foreground disabled:opacity-20" aria-label="up"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="tap p-0.5 text-muted-foreground disabled:opacity-20" aria-label="down"><ArrowDown className="h-4 w-4" /></button>
                </div>
                <button type="button" onClick={() => setEditing({ ...p })} className="tap flex min-w-0 flex-1 items-center gap-2 text-start">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-bold">{ar ? p.name_ar : p.name_en || p.name_ar}</span>
                      {offer && <span className="whitespace-nowrap rounded-full bg-ios-orange/15 px-2 py-px text-[10px] font-bold text-ios-orange">{ar ? "عرض" : "Offer"}</span>}
                    </span>
                    <span className="block truncate text-[13px] text-muted-foreground">{p.description_ar}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[15px] font-bold" dir="ltr">
                    <span className="inline-flex items-center gap-1"><Currency code={p.currency} className="text-muted-foreground" />{formatPrice(offer ? p.discounted_price as number : p.price as number)}</span>
                  </span>
                  <Chevron className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </button>
                <Switch checked={p.active} onCheckedChange={(v) => toggle(p, v)} aria-label={ar ? "ظاهرة للعملاء" : "Visible"} />
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-2 px-4 text-xs text-muted-foreground">{ar ? "المفتاح يُظهر الباقة أو يخفيها من الموقع. الأسهم لترتيبها." : "The switch shows/hides a package. Arrows reorder."}</p>

      <IosSheet
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title={editing?.id ? (ar ? "تعديل الباقة" : "Edit package") : ar ? "باقة جديدة" : "New package"}
        onSave={save}
        saving={saving}
      >
        {editing && (
          <>
            <FormGroup label={ar ? "الاسم" : "Name"}>
              <FormRow label="العربية"><input className={fieldCls} value={editing.name_ar} onChange={(e) => set({ name_ar: e.target.value })} placeholder="باقة الذهبية" /></FormRow>
              <FormRow label="English"><input className={fieldCls} dir="ltr" value={editing.name_en} onChange={(e) => set({ name_en: e.target.value })} placeholder="Gold" /></FormRow>
            </FormGroup>

            <FormGroup label={ar ? "المزايا" : "What's included"} footer={ar ? "افصل بين المزايا بعلامة + لتظهر كقائمة." : "Separate items with + to show them as a checklist."}>
              <FormRow label="العربية" stacked><textarea className={cn(fieldCls, "resize-none")} rows={2} value={editing.description_ar} onChange={(e) => set({ description_ar: e.target.value })} placeholder="تغطية ٤ ساعات + ٧٠ صورة معدلة + فيديو قصير" /></FormRow>
              <FormRow label="English" stacked><textarea className={cn(fieldCls, "resize-none")} dir="ltr" rows={2} value={editing.description_en} onChange={(e) => set({ description_en: e.target.value })} placeholder="4-hour coverage + 70 edited photos + short video" /></FormRow>
            </FormGroup>

            <FormGroup label={ar ? "السعر" : "Price"}>
              <FormRow label={t(lang, "price")}>
                <input className={fieldCls} type="number" inputMode="decimal" min={0} dir="ltr" value={editing.price} onChange={(e) => set({ price: e.target.value })} placeholder="150" />
              </FormRow>
              <FormRow label={ar ? "العملة" : "Currency"}>
                <input className={fieldCls} dir="ltr" value={editing.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} />
              </FormRow>
            </FormGroup>

            <FormGroup label={ar ? "عرض خاص (اختياري)" : "Special offer (optional)"} footer={ar ? "اترك سعر العرض فارغاً إن لم يوجد عرض." : "Leave empty when there's no offer."}>
              <FormRow label={t(lang, "discounted_price")}>
                <input className={fieldCls} type="number" inputMode="decimal" min={0} dir="ltr" value={editing.discounted_price ?? ""} onChange={(e) => set({ discounted_price: e.target.value })} placeholder="—" />
              </FormRow>
              <FormRow label={ar ? "ينتهي في" : "Ends on"}>
                <input
                  className={fieldCls}
                  type="date"
                  dir="ltr"
                  value={editing.offer_expiry_date ? editing.offer_expiry_date.slice(0, 10) : ""}
                  onChange={(e) => set({ offer_expiry_date: e.target.value ? new Date(`${e.target.value}T23:59:59`).toISOString() : null })}
                />
              </FormRow>
            </FormGroup>

            <FormGroup>
              <label className="ios-row">
                <span className="flex-1 text-[15px] font-semibold">{ar ? "ظاهرة للعملاء" : "Visible to clients"}</span>
                <Switch checked={editing.active} onCheckedChange={(v) => set({ active: v })} />
              </label>
            </FormGroup>

            {editing.id && (
              <FormGroup>
                <button type="button" onClick={remove} className="ios-row tap w-full justify-center font-semibold text-ios-red">
                  <Trash2 className="h-4 w-4" /> {ar ? "حذف الباقة" : "Delete package"}
                </button>
              </FormGroup>
            )}
          </>
        )}
      </IosSheet>
    </div>
  );
}
