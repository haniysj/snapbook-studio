import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { MediaImage } from "@/components/site/MediaImage";

export function GalleryTab() {
  const { lang } = useLang();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [newCat, setNewCat] = useState("");
  const [selCat, setSelCat] = useState<string>("");
  const [title, setTitle] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["admin_gallery_cats"],
    queryFn: async () => (await supabase.from("gallery_categories").select("*").order("sort_order")).data ?? [],
  });
  const { data: images = [] } = useQuery({
    queryKey: ["admin_gallery_imgs"],
    queryFn: async () => (await supabase.from("gallery_images").select("*, gallery_categories(name_ar)").order("sort_order")).data ?? [],
  });

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const { error } = await supabase.from("gallery_categories").insert({ name_ar: newCat.trim(), sort_order: categories.length });
    if (error) return toast.error(error.message);
    setNewCat("");
    qc.invalidateQueries({ queryKey: ["admin_gallery_cats"] });
    qc.invalidateQueries({ queryKey: ["gallery_categories"] });
  };
  const removeCategory = async (id: string) => {
    if (!confirm(lang === "ar" ? "حذف التصنيف؟" : "Delete category?")) return;
    await supabase.from("gallery_categories").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin_gallery_cats"] });
    qc.invalidateQueries({ queryKey: ["gallery_categories"] });
  };

  const uploadImage = async (file: File) => {
    const isVideo = file.type.startsWith("video/");
    const path = `gallery/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
    if (upErr) return toast.error(upErr.message);
    const { error } = await supabase.from("gallery_images").insert({
      url: path, title_ar: title, category_id: selCat || null, sort_order: images.length, active: true,
      media_type: isVideo ? "video" : "image",
    } as any);
    if (error) return toast.error(error.message);
    toast.success(lang === "ar" ? "تم الرفع" : "Uploaded");
    setTitle("");
    qc.invalidateQueries({ queryKey: ["admin_gallery_imgs"] });
    qc.invalidateQueries({ queryKey: ["gallery_images"] });
  };

  const removeImage = async (id: string, url: string) => {
    if (!confirm(lang === "ar" ? "حذف الصورة؟" : "Delete?")) return;
    if (!url.startsWith("http")) await supabase.storage.from("media").remove([url]);
    await supabase.from("gallery_images").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin_gallery_imgs"] });
    qc.invalidateQueries({ queryKey: ["gallery_images"] });
  };

  return (
    <div className="space-y-6">
      {/* Categories */}
      <div className="card-elegant p-4">
        <h3 className="mb-3 font-semibold">{t(lang, "category")}</h3>
        <div className="mb-3 flex gap-2">
          <Input placeholder={lang === "ar" ? "تصنيف جديد" : "New category"} value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <Button onClick={addCategory} className="gap-1"><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c: any) => (
            <span key={c.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs">
              {c.name_ar}
              <button onClick={() => removeCategory(c.id)}><Trash2 className="h-3 w-3 text-destructive" /></button>
            </span>
          ))}
        </div>
      </div>

      {/* Upload */}
      <div className="card-elegant p-4">
        <h3 className="mb-3 font-semibold">{t(lang, "upload_image")}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div><Label>{t(lang, "title")}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div>
            <Label>{t(lang, "category")}</Label>
            <Select value={selCat} onValueChange={setSelCat}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
            <Button onClick={() => fileRef.current?.click()} className="w-full gap-2 bg-gradient-to-r from-gold to-gold-soft text-primary-foreground">
              <Upload className="h-4 w-4" /> {t(lang, "upload_image")}
            </Button>
          </div>
        </div>
      </div>

      {/* Images grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {images.map((img: any) => (
          <div key={img.id} className="group relative overflow-hidden rounded-xl">
            <MediaImage path={img.url} alt={img.title_ar ?? ""} className="aspect-square w-full object-cover" />
            <button onClick={() => removeImage(img.id, img.url)} className="absolute top-2 end-2 rounded-full bg-destructive p-1.5 text-destructive-foreground opacity-0 transition group-hover:opacity-100">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {img.gallery_categories?.name_ar && (
              <span className="absolute bottom-2 start-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">{img.gallery_categories.name_ar}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
