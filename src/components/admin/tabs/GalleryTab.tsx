import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { EyeOff, ImagePlus, Loader2, Play, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/app-context";
import { Switch } from "@/components/ui/switch";
import { MediaImage } from "@/components/site/MediaImage";
import { MediaVideo } from "@/components/site/MediaVideo";
import { IosSheet, FormGroup, FormRow, fieldCls } from "@/components/admin/IosSheet";
import { cn } from "@/lib/utils";

type Cat = { id: string; name_ar: string; name_en: string | null; sort_order: number };
type Img = { id: string; url: string; title_ar: string | null; category_id: string | null; sort_order: number; active: boolean; media_type: string };

export function GalleryTab() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadCat, setUploadCat] = useState<string>("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [newCat, setNewCat] = useState("");
  const [editing, setEditing] = useState<Img | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin_gallery_cats"],
    queryFn: async () => ((await supabase.from("gallery_categories").select("*").order("sort_order")).data ?? []) as Cat[],
  });
  const { data: images = [], isLoading } = useQuery({
    queryKey: ["admin_gallery_imgs"],
    queryFn: async () => ((await supabase.from("gallery_images").select("*").order("sort_order")).data ?? []) as Img[],
  });
  const refresh = () => {
    ["admin_gallery_imgs", "gallery_images", "admin_gallery_cats", "gallery_categories"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const upload = async (files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!list.length) return;
    setProgress({ done: 0, total: list.length });
    let ok = 0;
    let order = images.length;
    for (const file of list) {
      const path = `gallery/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { data: up, error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
      if (!error && up) {
        const res = await supabase.from("gallery_images").insert({
          url: up.url, title_ar: "", category_id: uploadCat || null, sort_order: ++order, active: true,
          media_type: file.type.startsWith("video/") ? "video" : "image",
        });
        if (!res.error) ok++;
      } else {
        toast.error(`${file.name}: ${error?.message ?? "failed"}`);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    if (ok) toast.success(ar ? `تمت إضافة ${ok} ${ok === 1 ? "ملف" : "ملفات"}` : `Added ${ok} file${ok === 1 ? "" : "s"}`);
    refresh();
  };

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    const { error } = await supabase.from("gallery_categories").insert({ name_ar: name, name_en: "", sort_order: categories.length + 1 });
    if (error) return toast.error(error.message);
    setNewCat("");
    refresh();
  };
  const removeCategory = async (c: Cat) => {
    const n = images.filter((i) => i.category_id === c.id).length;
    if (!confirm(ar ? `حذف تصنيف «${c.name_ar}»؟${n ? ` (${n} من الصور ستبقى بدون تصنيف)` : ""}` : `Delete “${c.name_ar}”?`)) return;
    await supabase.from("gallery_categories").delete().eq("id", c.id);
    refresh();
  };

  const saveItem = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("gallery_images").update({
      title_ar: editing.title_ar ?? "", category_id: editing.category_id || null, active: editing.active,
    }).eq("id", editing.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setEditing(null);
    refresh();
  };
  const removeItem = async () => {
    if (!editing) return;
    if (!confirm(ar ? "حذف هذا الملف نهائياً؟" : "Delete this file permanently?")) return;
    if (editing.url.includes(".blob.vercel-storage.com/")) await supabase.storage.from("media").remove([editing.url]);
    await supabase.from("gallery_images").delete().eq("id", editing.id);
    setEditing(null);
    refresh();
  };
  const makeFirst = async () => {
    if (!editing) return;
    const min = Math.min(0, ...images.map((i) => i.sort_order));
    await supabase.from("gallery_images").update({ sort_order: min - 1 }).eq("id", editing.id);
    toast.success(ar ? "أصبحت الأولى في المعرض" : "Moved to the front");
    setEditing(null);
    refresh();
  };

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name_ar;

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="ios-card p-4">
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!!progress}
          className="tap flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-fill/50 py-7 disabled:opacity-80"
        >
          {progress ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin" />
              <span className="font-bold">{ar ? `جارٍ الرفع ${progress.done} من ${progress.total}` : `Uploading ${progress.done} of ${progress.total}`}</span>
              <span className="h-1.5 w-40 overflow-hidden rounded-full bg-fill">
                <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </span>
            </>
          ) : (
            <>
              <ImagePlus className="h-8 w-8" />
              <span className="font-bold">{ar ? "إضافة صور أو فيديو" : "Add photos or videos"}</span>
              <span className="text-xs text-muted-foreground">{ar ? "يمكنك اختيار عدة ملفات مرة واحدة" : "You can pick several files at once"}</span>
            </>
          )}
        </button>
        {categories.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-[13px] font-semibold text-muted-foreground">{ar ? "تُضاف إلى تصنيف:" : "Add to category:"}</div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {[{ id: "", name_ar: ar ? "بدون" : "None" } as Cat, ...categories].map((c) => (
                <button
                  key={c.id || "none"}
                  type="button"
                  onClick={() => setUploadCat(c.id)}
                  className={cn("tap shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold", uploadCat === c.id ? "bg-primary text-primary-foreground" : "bg-fill")}
                >
                  {c.name_ar}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div>
        <div className="section-label">{ar ? `المعرض (${images.length})` : `Gallery (${images.length})`}</div>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-1.5 md:grid-cols-5">{[...Array(6)].map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-xl bg-fill" />)}</div>
        ) : images.length === 0 ? (
          <div className="ios-card p-8 text-center text-sm text-muted-foreground">{ar ? "لم تُضف ملفات بعد" : "No files yet"}</div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 md:grid-cols-5">
            {images.map((img) => (
              <button key={img.id} type="button" onClick={() => setEditing({ ...img })} className="tap relative aspect-square overflow-hidden rounded-xl bg-fill">
                {img.media_type === "video" ? (
                  <MediaVideo path={img.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                ) : (
                  <MediaImage path={img.url} alt={img.title_ar ?? ""} className="h-full w-full object-cover" loading="lazy" />
                )}
                {img.media_type === "video" && <Play className="absolute end-1.5 top-1.5 h-4 w-4 fill-white text-white drop-shadow" />}
                {!img.active && (
                  <span className="absolute inset-0 grid place-items-center bg-black/50 text-white"><EyeOff className="h-5 w-5" /></span>
                )}
                {catName(img.category_id) && (
                  <span className="absolute bottom-1.5 start-1.5 max-w-[85%] truncate rounded-full bg-black/55 px-2 py-px text-[10px] font-semibold text-white backdrop-blur">
                    {catName(img.category_id)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 px-4 text-xs text-muted-foreground">{ar ? "اضغط على أي صورة لتعديل عنوانها أو تصنيفها أو حذفها." : "Tap any item to edit its title, category or delete it."}</p>
      </div>

      {/* Categories */}
      <div>
        <div className="section-label">{ar ? "التصنيفات" : "Categories"}</div>
        <div className="ios-card p-3">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-fill py-1 pe-1 ps-3 text-[13px] font-semibold">
                {c.name_ar}
                <button type="button" onClick={() => removeCategory(c)} className="tap grid h-5 w-5 place-items-center rounded-full bg-muted-foreground/20" aria-label={ar ? "حذف" : "Delete"}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              placeholder={ar ? "تصنيف جديد، مثل: تخرّج" : "New category, e.g. Graduation"}
              className="h-10 min-w-0 flex-1 rounded-xl bg-fill px-3 text-[15px] outline-none placeholder:text-muted-foreground"
            />
            <button type="button" onClick={addCategory} className="tap grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground" aria-label={ar ? "إضافة" : "Add"}>
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <IosSheet open={!!editing} onOpenChange={(v) => !v && setEditing(null)} title={ar ? "تفاصيل الملف" : "Item details"} onSave={saveItem} saving={saving}>
        {editing && (
          <>
            <div className="mb-5 overflow-hidden rounded-2xl bg-black">
              {editing.media_type === "video" ? (
                <MediaVideo path={editing.url} className="mx-auto max-h-[38dvh]" controls playsInline />
              ) : (
                <MediaImage path={editing.url} alt="" className="mx-auto max-h-[38dvh] object-contain" />
              )}
            </div>
            <FormGroup>
              <FormRow label={ar ? "العنوان" : "Title"}>
                <input className={fieldCls} value={editing.title_ar ?? ""} onChange={(e) => setEditing({ ...editing, title_ar: e.target.value })} placeholder={ar ? "اختياري" : "Optional"} />
              </FormRow>
              <label className="ios-row">
                <span className="w-[42%] shrink-0 text-[15px] font-semibold">{ar ? "التصنيف" : "Category"}</span>
                <select
                  value={editing.category_id ?? ""}
                  onChange={(e) => setEditing({ ...editing, category_id: e.target.value || null })}
                  className="min-w-0 flex-1 bg-transparent py-1 text-[15px] outline-none"
                >
                  <option value="">{ar ? "بدون" : "None"}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                </select>
              </label>
              <label className="ios-row">
                <span className="flex-1 text-[15px] font-semibold">{ar ? "ظاهرة في الموقع" : "Visible on site"}</span>
                <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </label>
            </FormGroup>
            <FormGroup>
              <button type="button" onClick={makeFirst} className="ios-row tap w-full justify-center font-semibold text-ios-blue">
                {ar ? "اجعلها الأولى في المعرض" : "Show first in gallery"}
              </button>
              <button type="button" onClick={removeItem} className="ios-row tap w-full justify-center font-semibold text-ios-red">
                <Trash2 className="h-4 w-4" /> {ar ? "حذف" : "Delete"}
              </button>
            </FormGroup>
          </>
        )}
      </IosSheet>
    </div>
  );
}
