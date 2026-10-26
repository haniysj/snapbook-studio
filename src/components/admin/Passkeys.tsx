import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, Loader2, ScanFace, Smartphone, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/app-context";
import { FormGroup } from "@/components/admin/IosSheet";
import { passkeyDelete, passkeyList } from "@/lib/passkey.functions";
import {
  biometricKind, biometricLabel, biometricsAvailable, deviceFlag, enableBiometrics, setDeviceFlag,
} from "@/lib/passkey-client";
import { cn } from "@/lib/utils";

export function BiometricIcon({ className }: { className?: string }) {
  return biometricKind() === "face" ? <ScanFace className={className} /> : <Fingerprint className={className} />;
}

function useBiometrics() {
  const [ok, setOk] = useState(false);
  useEffect(() => { biometricsAvailable().then(setOk); }, []);
  return ok;
}

async function runEnable(ar: boolean, done: () => void) {
  try {
    const r = await enableBiometrics();
    if (r === "cancelled") return;
    toast.success(r === "exists"
      ? (ar ? "البصمة مفعّلة مسبقاً على هذا الجهاز" : "Already enabled on this device")
      : (ar ? `تم تفعيل الدخول بـ${biometricLabel(true)} على هذا الجهاز` : `${biometricLabel(false)} sign-in enabled on this device`));
    done();
  } catch (e: any) {
    toast.error(e?.message ?? String(e));
  }
}

const DISMISS = "seven-passkey-dismissed";

/** One-time card on the dashboard offering to turn on Face ID / fingerprint for this device. */
export function PasskeyPrompt() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const supported = useBiometrics();
  const qc = useQueryClient();
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try { dismissed = !!localStorage.getItem(DISMISS); } catch { /* ignore */ }
    setHidden(dismissed || !!deviceFlag());
  }, []);
  if (!supported || hidden) return null;
  const later = () => { try { localStorage.setItem(DISMISS, "1"); } catch { /* ignore */ } setHidden(true); };
  const label = biometricLabel(ar);
  return (
    <div className="rise mb-5 flex items-center gap-3 rounded-[1.25rem] bg-primary/12 p-4 ring-1 ring-primary/20">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><BiometricIcon className="h-6 w-6" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold">{ar ? `ادخل بـ${label} بدل الرقم السري` : `Sign in with ${label}`}</div>
        <div className="text-[12.5px] text-muted-foreground">{ar ? "تستخدم بصمة هاتفك نفسها، ولا تُسجَّل بصمة جديدة. وافق على رسالة «حفظ مفتاح المرور» مرة واحدة." : "Uses the face/fingerprint already on your phone. Approve the one-time “Save passkey” message."}</div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => { setBusy(true); await runEnable(ar, () => { setHidden(true); qc.invalidateQueries({ queryKey: ["passkeys"] }); }); setBusy(false); }}
        className="tap inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {ar ? "تفعيل" : "Enable"}
      </button>
      <button type="button" onClick={later} aria-label={ar ? "لاحقاً" : "Later"} className="tap grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Settings → manage the devices that can sign in with biometrics for this account. */
export function PasskeySettings() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const supported = useBiometrics();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [mine, setMine] = useState<string | null>(null);
  useEffect(() => setMine(deviceFlag()), []);
  const { data: keys = [], isLoading } = useQuery({ queryKey: ["passkeys"], queryFn: () => passkeyList() });
  const thisDeviceOn = !!mine && keys.some((k) => k.id === mine);
  const label = biometricLabel(ar);

  const remove = async (id: string) => {
    if (!confirm(ar ? "إيقاف الدخول بالبصمة لهذا الجهاز؟" : "Turn off biometric sign-in for this device?")) return;
    setBusy(id);
    try {
      await passkeyDelete({ data: { id } });
      if (id === mine) { setDeviceFlag(null); setMine(null); }
      qc.invalidateQueries({ queryKey: ["passkeys"] });
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <FormGroup
      label={ar ? "الدخول بالبصمة" : "Biometric sign-in"}
      footer={ar
        ? "تُستخدم بصمة الوجه أو الإصبع المخزّنة في هاتفك نفسها، ولا تُسجَّل بصمة جديدة ولا تُرسل إلى المنصة. عند التفعيل يعرض الهاتف رسالة «حفظ مفتاح المرور» (Passkey) — وهو رمز أمان للموقع فقط، يُحفظ مرة واحدة. يبقى الرقم السري متاحاً دائماً."
        : "Uses the face/fingerprint already on your phone; nothing new is enrolled and nothing leaves the device. The one-time “Save passkey” message only stores a site key. The PIN always keeps working."}
    >
      <div className="ios-row">
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-white", thisDeviceOn ? "bg-ios-green" : "bg-[#8E8E93]")}>
          <BiometricIcon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{ar ? `${label} على هذا الجهاز` : `${label} on this device`}</span>
          <span className="block text-[12.5px] text-muted-foreground">
            {!supported
              ? (ar ? "هذا الجهاز أو المتصفح لا يدعم البصمة" : "Not supported on this device/browser")
              : thisDeviceOn ? (ar ? "مفعّلة" : "On") : (ar ? "غير مفعّلة" : "Off")}
          </span>
        </span>
        {supported && !thisDeviceOn && (
          <button
            type="button"
            disabled={busy === "add"}
            onClick={async () => { setBusy("add"); await runEnable(ar, () => { setMine(deviceFlag()); qc.invalidateQueries({ queryKey: ["passkeys"] }); }); setBusy(null); }}
            className="tap inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy === "add" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {ar ? "تفعيل" : "Enable"}
          </button>
        )}
      </div>
      {isLoading ? null : keys.map((k) => (
        <div key={k.id} className="ios-row">
          <Smartphone className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">
              {k.device_name || (ar ? "جهاز" : "Device")}
              {k.id === mine && <span className="ms-2 rounded-full bg-fill px-2 py-px text-[10.5px] font-bold text-muted-foreground">{ar ? "هذا الجهاز" : "This device"}</span>}
            </span>
            <span className="block text-[12px] text-muted-foreground">
              {ar ? `أُضيف ${k.created_at}` : `Added ${k.created_at}`}{k.last_used_at ? (ar ? ` · آخر دخول ${k.last_used_at}` : ` · last used ${k.last_used_at}`) : ""}
            </span>
          </span>
          <button type="button" onClick={() => remove(k.id)} disabled={busy === k.id} aria-label={ar ? "إيقاف" : "Remove"} className="tap grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ios-red/10 text-ios-red">
            {busy === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      ))}
    </FormGroup>
  );
}
