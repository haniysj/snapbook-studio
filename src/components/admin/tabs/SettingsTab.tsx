import { useEffect, useRef, useState } from "react";
import { Check, ImageUp, Loader2, RotateCcw } from "lucide-react";
import { THEMES, applySiteTheme } from "@/lib/themes";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang, useSettings } from "@/lib/app-context";
import { BrandLogo } from "@/components/site/BrandLogo";
import { FormGroup, FormRow, fieldCls } from "@/components/admin/IosSheet";
import { cn } from "@/lib/utils";
import { MyContactCard } from "@/components/admin/MyContactCard";

export function SettingsTab() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const { settings, refresh } = useSettings();
  const [siteName, setSiteName] = useState(settings.site_name);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp_number);
  const [instagram, setInstagram] = useState(settings.instagram_url ?? "");
  const [bank, setBank] = useState(settings.bank_details);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSiteName(settings.site_name);
    setWhatsapp(settings.whatsapp_number);
    setInstagram(settings.instagram_url ?? "");
    setBank(settings.bank_details);
  }, [settings]);

  const dirty =
    siteName !== settings.site_name ||
    whatsapp !== settings.whatsapp_number ||
    instagram !== (settings.instagram_url ?? "") ||
    bank !== settings.bank_details;

  // Logo changes are saved immediately — no separate "Save" needed.
  const setLogo = async (url: string | null) => {
    const { error } = await supabase.from("settings").update({ logo_url: url }).eq("id", 1);
    if (error) throw new Error(error.message);
    await refresh();
  };

  const uploadLogo = async (f: File) => {
    if (!f.type.startsWith("image/")) return toast.error(ar ? "اختر صورة" : "Choose an image");
    setLogoBusy(true);
    try {
      const path = `logo/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { data: up, error } = await supabase.storage.from("media").upload(path, f, { contentType: f.type });
      if (error || !up) throw new Error(error?.message ?? "Upload failed");
      await setLogo(up.url);
      toast.success(ar ? "تم تغيير الشعار" : "Logo updated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLogoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const restoreLogo = async () => {
    setLogoBusy(true);
    try {
      await setLogo(null);
      toast.success(ar ? "تمت استعادة الشعار الأصلي" : "Original logo restored");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLogoBusy(false);
    }
  };

  const [themeBusy, setThemeBusy] = useState<string | null>(null);
  const chooseTheme = async (id: string) => {
    if (id === settings.theme) return;
    const prev = settings.theme;
    applySiteTheme(id); // preview instantly
    setThemeBusy(id);
    const { error } = await supabase.from("settings").update({ theme: id }).eq("id", 1);
    setThemeBusy(null);
    if (error) { applySiteTheme(prev); return toast.error(error.message); }
    await refresh();
    toast.success(ar ? "تم تطبيق الثيم على المنصة" : "Theme applied to the site");
  };

  const save = async () => {
    if (!siteName.trim()) return toast.error(ar ? "اكتب اسم المنصة" : "Enter the site name");
    setSaving(true);
    const { error } = await supabase.from("settings").update({
      site_name: siteName.trim(),
      whatsapp_number: whatsapp.trim(),
      bank_details: bank,
      instagram_url: instagram.trim() || null,
    }).eq("id", 1);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(ar ? "تم الحفظ" : "Saved");
    await refresh();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <MyContactCard />

      <FormGroup label={ar ? "الشعار" : "Logo"} footer={ar ? "يظهر الشعار في أعلى الموقع وأيقونة المتصفح. يُحفظ فور التغيير." : "Shown in the header and browser icon. Saved immediately."}>
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-2xl bg-fill p-2.5">
            {logoBusy ? <Loader2 className="h-6 w-6 animate-spin" /> : <BrandLogo className="max-h-[76px] max-w-full" />}
          </div>
          <div className="flex min-w-0 flex-col items-start gap-2">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            <button type="button" disabled={logoBusy} onClick={() => fileRef.current?.click()} className="tap inline-flex h-9 items-center gap-1.5 rounded-full bg-fill px-4 text-sm font-bold disabled:opacity-50">
              <ImageUp className="h-4 w-4" /> {ar ? "تغيير الشعار" : "Change logo"}
            </button>
            {settings.logo_url && (
              <button type="button" disabled={logoBusy} onClick={restoreLogo} className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-ios-blue disabled:opacity-50">
                <RotateCcw className="h-3.5 w-3.5" /> {ar ? "استعادة الشعار الأصلي (7 CAM)" : "Restore original logo (7 CAM)"}
              </button>
            )}
            <span className="text-xs text-muted-foreground">{ar ? "يفضّل PNG بخلفية شفافة" : "Transparent PNG works best"}</span>
          </div>
        </div>
      </FormGroup>

      <FormGroup label={ar ? "ثيم المنصة" : "Site theme"} footer={ar ? "يتغيّر لون المنصة ونقش الخلفية لجميع الزوار فوراً. الوضع الفاتح/الداكن يتبع جهاز الزائر." : "Changes colors and background pattern for every visitor. Light/dark still follows each device."}>
        <div className="grid grid-cols-4 gap-2 p-3 sm:grid-cols-7">
          {THEMES.map((th) => {
            const active = (settings.theme || "sage") === th.id;
            return (
              <button
                key={th.id}
                type="button"
                onClick={() => chooseTheme(th.id)}
                aria-pressed={active}
                className={cn(
                  "tap flex flex-col items-center gap-1.5 rounded-2xl p-2 transition",
                  active ? "bg-fill ring-2 ring-primary" : "hover:bg-fill/60",
                )}
              >
                <span
                  className="relative grid h-12 w-12 place-items-center rounded-full shadow-inner"
                  style={{ backgroundImage: `linear-gradient(135deg, ${th.swatch[0]}, ${th.swatch[1]})` }}
                >
                  {themeBusy === th.id ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : active && <Check className="h-5 w-5 text-white" strokeWidth={3} />}
                </span>
                <span className="text-[13px] font-bold leading-tight">{ar ? th.ar : th.en}</span>
                <span className="text-[10.5px] leading-tight text-muted-foreground">{ar ? th.patternAr : th.patternEn}</span>
              </button>
            );
          })}
        </div>
      </FormGroup>

      <FormGroup label={ar ? "المنصة" : "Site"}>
        <FormRow label={ar ? "اسم المنصة" : "Site name"}>
          <input className={fieldCls} value={siteName} onChange={(e) => setSiteName(e.target.value)} />
        </FormRow>
      </FormGroup>

      <FormGroup label={ar ? "التواصل" : "Contact"} footer={ar ? "رقم الواتساب يُستخدم لزر واتساب العائم ورسائل الحجز." : "Used by the floating WhatsApp button and booking messages."}>
        <FormRow label={ar ? "رقم الواتساب" : "WhatsApp"}>
          <input className={fieldCls} dir="ltr" type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+968 9xxx xxxx" />
        </FormRow>
        <FormRow label={ar ? "انستقرام" : "Instagram"}>
          <input className={fieldCls} dir="ltr" inputMode="url" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/…" />
        </FormRow>
      </FormGroup>

      <FormGroup label={ar ? "بيانات التحويل" : "Bank details"} footer={ar ? "تظهر للعميل بعد إرسال طلب الحجز مع زر نسخ." : "Shown to the client after booking, with a copy button."}>
        <div className="px-4 py-3">
          <textarea className={cn(fieldCls, "resize-none leading-7")} rows={5} value={bank} onChange={(e) => setBank(e.target.value)} />
        </div>
      </FormGroup>

      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty}
        className="tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground disabled:bg-fill disabled:text-muted-foreground"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {dirty ? (ar ? "حفظ التغييرات" : "Save changes") : ar ? "لا توجد تغييرات" : "No changes"}
      </button>
    </div>
  );
}
