import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang, useSettings } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { MediaImage } from "@/components/site/MediaImage";

export function SettingsTab() {
  const { lang } = useLang();
  const { settings, refresh } = useSettings();
  const [siteName, setSiteName] = useState(settings.site_name);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp_number);
  const [instagram, setInstagram] = useState(settings.instagram_url ?? "");
  const [bank, setBank] = useState(settings.bank_details);
  const [logoUrl, setLogoUrl] = useState(settings.logo_url ?? "");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSiteName(settings.site_name);
    setWhatsapp(settings.whatsapp_number);
    setInstagram(settings.instagram_url ?? "");
    setBank(settings.bank_details);
    setLogoUrl(settings.logo_url ?? "");
  }, [settings]);


  const uploadLogo = async (f: File) => {
    const path = `logo/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error } = await supabase.storage.from("media").upload(path, f, { upsert: true });
    if (error) return toast.error(error.message);
    setLogoUrl(path);
    toast.success(lang === "ar" ? "تم رفع الشعار" : "Logo uploaded");
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update({
      site_name: siteName, whatsapp_number: whatsapp, bank_details: bank, logo_url: logoUrl || null,
      instagram_url: instagram.trim() || null,
    } as any).eq("id", 1);

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
    await refresh();
  };

  return (
    <div className="card-elegant space-y-4 p-6">
      <div><Label>{t(lang, "site_name")}</Label><Input value={siteName} onChange={(e) => setSiteName(e.target.value)} /></div>
      <div>
        <Label>{t(lang, "logo")}</Label>
        <div className="flex items-center gap-3">
          {logoUrl && <MediaImage path={logoUrl} alt="logo" className="h-14 w-14 rounded-full object-cover ring-1 ring-gold/40" />}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> {t(lang, "upload_image")}</Button>
          {logoUrl && <Button variant="ghost" onClick={() => setLogoUrl("")}>{t(lang, "cancel")}</Button>}
        </div>
      </div>
      <div><Label>{t(lang, "whatsapp_number")}</Label><Input dir="ltr" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+968..." /></div>
      <div><Label>{t(lang, "bank_details_label")}</Label><Textarea rows={6} value={bank} onChange={(e) => setBank(e.target.value)} /></div>
      <Button onClick={save} disabled={saving} className="gap-2 bg-gradient-to-r from-gold to-gold-soft text-primary-foreground">
        <Save className="h-4 w-4" /> {saving ? "..." : t(lang, "save")}
      </Button>
    </div>
  );
}
