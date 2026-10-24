import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, BellRing, Loader2, Share, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { notifMarkSeen, notifSummary, pushPublicKey, pushSubscribe, pushTest, pushUnsubscribe, type NotifItem } from "@/lib/notify.functions";
import { useLang } from "@/lib/app-context";
import { IosSheet, FormGroup } from "@/components/admin/IosSheet";
import { cn } from "@/lib/utils";

const POLL_MS = 20_000;

/** Shared summary query (bell + live alerts). */
function useSummary() {
  const fetchSummary = useServerFn(notifSummary);
  return useQuery({
    queryKey: ["notif_summary"],
    queryFn: () => fetchSummary(),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

/** Plays a short two-tone chime (works after the PIN keypad tap unlocked audio). */
let audioCtx: AudioContext | null = null;
function chime() {
  try {
    audioCtx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    [880, 1318.5].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t); o.stop(t + 0.4);
    });
  } catch { /* ignore */ }
}

/** Toast + chime + vibration when a new booking arrives while the dashboard is open. */
export function useLiveBookingAlerts() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const { data } = useSummary();
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.items.map((i) => i.id));
    if (known.current) {
      const fresh = data.items.filter((i) => !known.current!.has(i.id));
      if (fresh.length) {
        const b = fresh[0];
        chime();
        try { navigator.vibrate?.([120, 60, 120]); } catch { /* ignore */ }
        toast(ar ? "📸 حجز جديد" : "📸 New booking", {
          description: `${b.customer_name} — ${prettyDate(b.event_date, ar)} · ${b.event_time}${fresh.length > 1 ? ` (+${fresh.length - 1})` : ""}`,
          duration: 8000,
        });
        qc.invalidateQueries({ queryKey: ["admin_bookings"] });
        qc.invalidateQueries({ queryKey: ["booked_dates_rpc"] });
      }
    }
    known.current = ids;
  }, [data, ar, qc]);
}

/* ---------------- push (phone/computer notifications) ---------------- */

function b64ToUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type PushState = "unsupported" | "ios-install" | "denied" | "off" | "on" | "loading";

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

function usePush() {
  const getKey = useServerFn(pushPublicKey);
  const subscribe = useServerFn(pushSubscribe);
  const unsubscribe = useServerFn(pushUnsubscribe);
  const [state, setState] = useState<PushState>("loading");

  const refresh = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(isIOS() && !isStandalone() ? "ios-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("denied");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setState(sub ? "on" : "off");
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = async () => {
    setState("loading");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return false; }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const { key } = await getKey();
      if (!key) throw new Error("missing key");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) }));
      const json = sub.toJSON() as any;
      await subscribe({ data: { endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, ua: navigator.userAgent } });
      setState("on");
      return true;
    } catch (e: any) {
      console.error(e);
      await refresh();
      throw e;
    }
  };

  const disable = async () => {
    setState("loading");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      try { await unsubscribe({ data: { endpoint: sub.endpoint } }); } catch { /* ignore */ }
      await sub.unsubscribe();
    }
    setState("off");
  };

  return { state, enable, disable };
}

/* ---------------- bell + sheet ---------------- */

export function NotificationsBell() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const { data } = useSummary();
  const markSeen = useServerFn(notifMarkSeen);
  const sendTest = useServerFn(pushTest);
  const push = usePush();
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const unread = data?.unread ?? 0;

  const onOpenChange = async (v: boolean) => {
    setOpen(v);
    if (!v && unread > 0) {
      await markSeen();
      qc.invalidateQueries({ queryKey: ["notif_summary"] });
    }
  };

  const enable = async () => {
    try {
      const ok = await push.enable();
      if (ok) toast.success(ar ? "تم تفعيل التنبيهات على هذا الجهاز" : "Notifications enabled on this device");
    } catch {
      toast.error(ar ? "تعذّر تفعيل التنبيهات" : "Couldn't enable notifications");
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await sendTest();
      if (!r.total) toast.error(ar ? "لا يوجد جهاز مفعّل" : "No device enabled");
      else toast.success(ar ? `أُرسل التنبيه التجريبي (${r.sent}/${r.total})` : `Test sent (${r.sent}/${r.total})`);
    } catch { toast.error(ar ? "تعذّر الإرسال" : "Couldn't send"); }
    setTesting(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fill"
        aria-label={ar ? `التنبيهات${unread ? ` (${unread} جديد)` : ""}` : `Notifications${unread ? ` (${unread} new)` : ""}`}
      >
        {unread > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ios-red px-1 text-[11px] font-bold text-white ltr:-right-0.5 rtl:-left-0.5">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <IosSheet open={open} onOpenChange={onOpenChange} title={ar ? "التنبيهات" : "Notifications"}>
        <PushPanel state={push.state} onEnable={enable} onDisable={push.disable} onTest={test} testing={testing} />

        <FormGroup label={ar ? "آخر الحجوزات" : "Latest bookings"}>
          {!data ? (
            <div className="ios-row justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : data.items.length === 0 ? (
            <div className="ios-row text-sm text-muted-foreground">{ar ? "لا توجد حجوزات بعد" : "No bookings yet"}</div>
          ) : (
            data.items.map((i) => <NotifRow key={i.id} item={i} />)
          )}
        </FormGroup>
      </IosSheet>
    </>
  );
}

function NotifRow({ item }: { item: NotifItem }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const when = timeAgo(item.created_at, ar);
  return (
    <div className="ios-row items-start">
      <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", item.is_new ? "bg-ios-blue" : "bg-transparent")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-bold">{item.customer_name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{when}</span>
        </div>
        <div className="text-[13px] text-muted-foreground">
          {prettyDate(item.event_date, ar)} · <span dir="ltr">{item.event_time}</span>
          {item.pkg && <> · {item.pkg}</>}
        </div>
      </div>
    </div>
  );
}

function PushPanel({ state, onEnable, onDisable, onTest, testing }: {
  state: PushState; onEnable: () => void; onDisable: () => void; onTest: () => void; testing: boolean;
}) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const footer =
    state === "ios-install"
      ? ar ? "على الآيفون: افتح الموقع في Safari ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية»، ثم افتح لوحة التحكم من الأيقونة وفعّل التنبيهات." : "On iPhone: open in Safari → Share → “Add to Home Screen”, then open the dashboard from the icon and enable notifications."
      : state === "denied"
        ? ar ? "التنبيهات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح ثم عد هنا." : "Notifications are blocked for this site. Allow them in browser settings, then come back."
        : ar ? "يصلك تنبيه على هذا الجهاز عند كل حجز جديد، حتى لو كانت لوحة التحكم مغلقة. فعّلها على كل جهاز تستخدمه." : "Get an alert on this device for every new booking, even when the dashboard is closed. Enable on each device you use.";

  return (
    <FormGroup label={ar ? "تنبيهات هذا الجهاز" : "This device"} footer={footer}>
      <div className="ios-row">
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-white", state === "on" ? "bg-ios-green" : "bg-[#8E8E93]")}>
          {state === "ios-install" ? <Share className="h-[17px] w-[17px]" /> : state === "on" ? <Smartphone className="h-[17px] w-[17px]" /> : <BellOff className="h-[17px] w-[17px]" />}
        </span>
        <span className="flex-1 text-[15px] font-semibold">
          {state === "on" ? (ar ? "التنبيهات مفعّلة" : "Notifications on")
            : state === "ios-install" ? (ar ? "أضف الموقع للشاشة الرئيسية أولاً" : "Add to Home Screen first")
            : state === "denied" ? (ar ? "محظورة من المتصفح" : "Blocked by browser")
            : state === "unsupported" ? (ar ? "المتصفح لا يدعم التنبيهات" : "Not supported here")
            : (ar ? "التنبيهات متوقفة" : "Notifications off")}
        </span>
        {state === "loading" && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {state === "off" && (
          <button type="button" onClick={onEnable} className="tap h-8 rounded-full bg-primary px-3.5 text-[13px] font-bold text-primary-foreground">
            {ar ? "تفعيل" : "Enable"}
          </button>
        )}
        {state === "on" && (
          <button type="button" onClick={onDisable} className="tap h-8 rounded-full bg-fill px-3.5 text-[13px] font-bold">
            {ar ? "إيقاف" : "Turn off"}
          </button>
        )}
      </div>
      {state === "on" && (
        <button type="button" onClick={onTest} disabled={testing} className="ios-row tap w-full justify-center font-semibold text-ios-blue disabled:opacity-50">
          {testing && <Loader2 className="h-4 w-4 animate-spin" />}
          {ar ? "إرسال تنبيه تجريبي" : "Send a test notification"}
        </button>
      )}
    </FormGroup>
  );
}

function timeAgo(iso: string, ar: boolean) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return ar ? "الآن" : "now";
  const m = Math.floor(s / 60);
  if (m < 60) return ar ? `قبل ${m} د` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return ar ? `قبل ${h} س` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return ar ? `قبل ${d} يوم` : `${d}d ago`;
}

function prettyDate(ymd: string, ar: boolean) {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString(ar ? "ar-OM" : "en-GB", { weekday: "short", day: "numeric", month: "short" });
}
