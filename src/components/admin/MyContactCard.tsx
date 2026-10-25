import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eraser, ImageUp, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { useLang, useSettings } from "@/lib/app-context";
import { getMyContact, saveMyContact } from "@/lib/docs.functions";
import { FormGroup, FormRow, fieldCls } from "@/components/admin/IosSheet";
import { cn } from "@/lib/utils";

const INK = "#1b2333";
const PAD_H = 170;

/** Crops transparent/white margins and scales the result to a compact PNG data URL. */
function exportTrimmed(src: HTMLCanvasElement): string {
  const ctx = src.getContext("2d")!;
  const { width: w, height: h } = src;
  const px = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = px[i + 3];
      const nearWhite = px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235;
      if (a > 16 && !nearWhite) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return "";
  const pad = 6;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const s = Math.min(1, 220 / ch, 640 / cw);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cw * s));
  out.height = Math.max(1, Math.round(ch * s));
  out.getContext("2d")!.drawImage(src, x0, y0, cw, ch, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

/** Each supervisor's own contact block for quotations: name, phone and signature. */
export function MyContactCard() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const { settings } = useSettings();
  const { data, isLoading } = useQuery({ queryKey: ["my_contact"], queryFn: () => getMyContact() });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sig, setSig] = useState("");          // saved/current signature (data URL)
  const [drawing, setDrawing] = useState(false); // pad open
  const [inked, setInked] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!data) return;
    setName(data.contact_name); setPhone(data.contact_phone); setSig(data.signature);
  }, [data]);

  // size the pad to its box (crisp on retina)
  useEffect(() => {
    if (!drawing) return;
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = Math.round(c.clientWidth * ratio);
    c.height = Math.round(PAD_H * ratio);
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
    setInked(false);
  }, [drawing]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    canvas.current!.setPointerCapture(e.pointerId);
    last.current = pos(e);
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath(); ctx.arc(last.current.x, last.current.y, 1.3, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
    setInked(true);
  };
  const move = (e: React.PointerEvent) => {
    if (!last.current) return;
    const p = pos(e);
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  };
  const up = () => { last.current = null; };

  const clearPad = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setInked(false);
  };

  const usePad = () => {
    const url = exportTrimmed(canvas.current!);
    if (!url) return toast.error(ar ? "وقّع داخل المربع أولاً" : "Sign inside the box first");
    setSig(url); setDrawing(false);
  };

  const uploadImage = (f: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return toast.error(ar ? "اختر صورة PNG أو JPG" : "Choose a PNG or JPG image");
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      const s = Math.min(1, 900 / img.width, 400 / img.height);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const out = exportTrimmed(c);
      if (!out) return toast.error(ar ? "الصورة فارغة" : "The image is empty");
      setSig(out); setDrawing(false);
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast.error(ar ? "تعذّر قراءة الصورة" : "Couldn't read the image"); };
    img.src = url;
    if (fileRef.current) fileRef.current.value = "";
  };

  const dirty = !!data && (name !== data.contact_name || phone !== data.contact_phone || sig !== data.signature);

  const save = async () => {
    if (name.trim() && name.trim().length < 3) return toast.error(ar ? "اكتب الاسم كاملاً" : "Enter the full name");
    setSaving(true);
    try {
      await saveMyContact({ data: { contact_name: name.trim(), contact_phone: phone.trim(), signature: sig } });
      await qc.invalidateQueries({ queryKey: ["my_contact"] });
      await qc.invalidateQueries({ queryKey: ["approvers"] });
      toast.success(ar ? "تم حفظ بيانات التواصل والتوقيع" : "Contact & signature saved");
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const btn = "tap inline-flex h-9 items-center gap-1.5 rounded-full bg-fill px-3.5 text-[13px] font-bold disabled:opacity-50";

  return (
    <div className="mb-6">
      <FormGroup
        label={ar ? "بياناتي في عروض الأسعار" : "My details on quotations"}
        footer={ar
          ? "تظهر في نهاية عرض السعر عند اختيارك في «اعتماد بواسطة». الحساب الذي لا يحتوي على اسم لا يظهر في القائمة."
          : "Shown at the end of a quotation when you're picked under “Approved by”. Accounts without a name aren't listed."}
      >
        <FormRow label={ar ? "الاسم" : "Name"}>
          <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={ar ? "الاسم الكامل كما يظهر في العرض" : "Full name as shown"} disabled={isLoading} />
        </FormRow>
        <FormRow label={ar ? "رقم الهاتف" : "Phone"}>
          <input className={fieldCls} dir="ltr" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+968 9xxx xxxx" disabled={isLoading} />
        </FormRow>

        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">{ar ? "التوقيع" : "Signature"}</span>
            {!drawing && sig && (
              <button type="button" onClick={() => setSig("")} className="tap text-[13px] font-semibold text-ios-red">{ar ? "إزالة" : "Remove"}</button>
            )}
          </div>

          {drawing ? (
            <>
              <canvas
                ref={canvas}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                className="block w-full touch-none rounded-xl border border-dashed border-muted-foreground/40 bg-white"
                style={{ height: PAD_H }}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={usePad} disabled={!inked} className={cn(btn, "bg-primary text-primary-foreground")}>
                  <PenLine className="h-4 w-4" /> {ar ? "اعتماد التوقيع" : "Use signature"}
                </button>
                <button type="button" onClick={clearPad} disabled={!inked} className={btn}><Eraser className="h-4 w-4" /> {ar ? "مسح" : "Clear"}</button>
                <button type="button" onClick={() => setDrawing(false)} className="tap px-2 text-[13px] font-semibold text-ios-blue">{ar ? "إلغاء" : "Cancel"}</button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{ar ? "وقّع بإصبعك أو بالماوس داخل المربع." : "Sign with your finger or mouse inside the box."}</p>
            </>
          ) : (
            <>
              <div className="grid h-[110px] place-items-center rounded-xl bg-white ring-1 ring-black/5">
                {sig
                  ? <img src={sig} alt={ar ? "التوقيع" : "Signature"} className="max-h-[90px] max-w-[85%] object-contain" />
                  : <span className="text-sm text-neutral-400">{ar ? "لا يوجد توقيع" : "No signature"}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setDrawing(true)} className={btn}><PenLine className="h-4 w-4" /> {sig ? (ar ? "توقيع جديد" : "New signature") : ar ? "ارسم التوقيع" : "Draw signature"}</button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                <button type="button" onClick={() => fileRef.current?.click()} className={btn}><ImageUp className="h-4 w-4" /> {ar ? "رفع صورة" : "Upload image"}</button>
              </div>
            </>
          )}
        </div>

        {(name.trim() || phone.trim()) && (
          <div className="px-4 py-3">
            <div className="mb-2 text-[13px] font-semibold text-muted-foreground">{ar ? "كيف يظهر في العرض" : "How it looks"}</div>
            <div dir="rtl" className="flex items-end justify-between gap-4 rounded-xl bg-white px-4 py-3 text-[#1b2333] ring-1 ring-black/5">
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-primary">للتواصل والاستفسار:</div>
                <div className="mt-1 truncate text-[15px] font-bold">{name.trim() || "—"}</div>
                <div dir="rtl" className="mt-0.5 whitespace-nowrap text-[12.5px] text-neutral-500">
                  {[phone.trim(), settings.quote_contact_link].filter(Boolean).map((x, i) => (
                    <span key={i}>{i > 0 && <span className="mx-2.5 text-neutral-300">|</span>}<bdi dir="ltr">{x}</bdi></span>
                  ))}
                </div>
              </div>
              {sig && <img src={sig} alt="" className="h-12 w-auto max-w-[40%] shrink-0 object-contain" />}
            </div>
          </div>
        )}
      </FormGroup>

      <button
        type="button"
        onClick={save}
        disabled={saving || !dirty || drawing}
        className="tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground disabled:bg-fill disabled:text-muted-foreground"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {dirty ? (ar ? "حفظ بياناتي" : "Save my details") : ar ? "لا توجد تغييرات" : "No changes"}
      </button>
    </div>
  );
}
