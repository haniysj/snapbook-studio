import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

type Pkg = {
  id?: string; name_ar: string; name_en: string; description_ar: string; description_en: string;
  price: number; currency: string; sort_order: number; active: boolean;
  discounted_price: number | null; offer_expiry_date: string | null;
};
const empty: Pkg = { name_ar: "", name_en: "", description_ar: "", description_en: "", price: 0, currency: "OMR", sort_order: 0, active: true, discounted_price: null, offer_expiry_date: null };


export function PackagesTab() {
  const { lang } = useLang();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Pkg | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin_packages"],
    queryFn: async () => (await supabase.from("packages").select("*").order("sort_order")).data ?? [],
  });

  const save = async () => {
    if (!editing) return;
    const payload = { ...editing };
    let error;
    if (payload.id) {
      ({ error } = await supabase.from("packages").update(payload).eq("id", payload.id));
    } else {
      const { id: _omit, ...ins } = payload;
      ({ error } = await supabase.from("packages").insert(ins));
    }
    if (error) return toast.error(error.message);
    toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin_packages"] });
    qc.invalidateQueries({ queryKey: ["packages"] });
  };

  const remove = async (id: string) => {
    if (!confirm(lang === "ar" ? "حذف الباقة؟" : "Delete?")) return;
    const { error } = await supabase.from("packages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin_packages"] });
    qc.invalidateQueries({ queryKey: ["packages"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ ...empty })} className="gap-1 bg-gradient-to-r from-gold to-gold-soft text-primary-foreground">
          <Plus className="h-4 w-4" /> {t(lang, "add")}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((p: any) => (
          <div key={p.id} className="card-elegant p-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold">{p.name_ar}</h4>
                <p className="text-xs text-muted-foreground">{p.description_ar}</p>
                <p className="mt-1 text-sm gold-text font-bold">
                  {p.discounted_price != null ? (
                    <>
                      {Number(p.discounted_price).toLocaleString()} {p.currency}
                      <span className="ms-2 text-muted-foreground line-through">{Number(p.price).toLocaleString()}</span>
                    </>
                  ) : (
                    <>{Number(p.price).toLocaleString()} {p.currency}</>
                  )}
                </p>

              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}>{t(lang, "edit")}</Button>
                <Button size="sm" variant="outline" onClick={() => remove(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="card-elegant space-y-3 p-4">
          <h3 className="font-semibold">{editing.id ? t(lang, "edit") : t(lang, "add")}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <F label="الاسم (AR)"><Input value={editing.name_ar} onChange={(e) => setEditing({ ...editing, name_ar: e.target.value })} /></F>
            <F label="Name (EN)"><Input value={editing.name_en} onChange={(e) => setEditing({ ...editing, name_en: e.target.value })} /></F>
            <F label="الوصف (AR)"><Textarea value={editing.description_ar} onChange={(e) => setEditing({ ...editing, description_ar: e.target.value })} /></F>
            <F label="Description (EN)"><Textarea value={editing.description_en} onChange={(e) => setEditing({ ...editing, description_en: e.target.value })} /></F>
            <F label={t(lang, "price")}><Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></F>
            <F label="Currency"><Input value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} /></F>
            <F label={t(lang, "discounted_price")}>
              <Input
                type="number"
                value={editing.discounted_price ?? ""}
                placeholder={lang === "ar" ? "اتركه فارغاً إن لم يوجد عرض" : "Leave blank if no offer"}
                onChange={(e) => setEditing({ ...editing, discounted_price: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </F>
            <F label={t(lang, "offer_expiry_date")}>
              <Input
                type="date"
                value={editing.offer_expiry_date ? editing.offer_expiry_date.slice(0, 10) : ""}
                onChange={(e) => setEditing({ ...editing, offer_expiry_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </F>
            <F label="Sort order"><Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></F>
            <F label="Active"><Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /></F>

          </div>
          <div className="flex gap-2">
            <Button onClick={save} className="gap-1 bg-gradient-to-r from-gold to-gold-soft text-primary-foreground"><Save className="h-4 w-4" /> {t(lang, "save")}</Button>
            <Button variant="outline" onClick={() => setEditing(null)}>{t(lang, "cancel")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
