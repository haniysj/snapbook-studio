import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Delete, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase, type Session } from "@/integrations/supabase/client";
import { Header } from "@/components/site/Header";
import { BrandLogo } from "@/components/site/BrandLogo";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { lang } = useLang();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="min-h-dvh">
        <Header title={t(lang, "admin_dashboard")} />
        <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-dvh">
        <Header title={t(lang, "admin_dashboard")} />
        <PinPad />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <Header title={t(lang, "admin_dashboard")} />
      <AdminDashboard session={session} />
    </div>
  );
}

const LEN = 8; // PINs are 8 digits
const MIN = 6; // older shorter PINs can still press «دخول»
const MAX = LEN;

/** iPhone-style passcode entry: dots + keypad, also works with a physical keyboard. */
function PinPad() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = useCallback(async (value: string) => {
    if (value.length < MIN || busy) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPin(value);
    setBusy(false);
    if (error) {
      setPin("");
      setShake(true);
      setTimeout(() => setShake(false), 450);
      toast.error(
        error.message === "locked"
          ? ar ? "محاولات خاطئة كثيرة. حاول بعد 15 دقيقة." : "Too many wrong attempts. Try again in 15 minutes."
          : ar ? "الرقم السري غير صحيح" : "Incorrect PIN",
      );
    }
  }, [busy, ar]);

  const press = (d: string) => {
    if (pin.length >= MAX || busy) return;
    const next = pin + d;
    setPin(next);
    if (next.length === LEN) submit(next); // sign in automatically on the 8th digit
  };
  const back = () => setPin((p) => p.slice(0, -1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
      else if (e.key === "Enter") submit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pin, submit]);

  const dots = LEN;

  return (
    <div className="mx-auto flex max-w-xs flex-col items-center px-6 pb-10 pt-8">
      <BrandLogo className="h-20 w-auto" />
      <h1 className="mt-5 text-lg font-bold">{ar ? "أدخل الرقم السري" : "Enter PIN"}</h1>
      <p className="mt-1 text-center text-xs text-muted-foreground">{ar ? "للدخول إلى لوحة التحكم" : "to open the dashboard"}</p>

      <div className={cn("mt-6 flex h-4 items-center gap-3", shake && "animate-[shake_.4s_ease]")} dir="ltr" aria-live="polite">
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-3 w-3 rounded-full border-[1.5px] border-foreground transition-colors",
              i < pin.length && "bg-foreground",
            )}
          />
        ))}
      </div>

      <div className="mt-9 grid grid-cols-3 gap-x-6 gap-y-4" dir="ltr">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)}>{d}</Key>
        ))}
        <button
          type="button"
          onClick={back}
          disabled={!pin}
          aria-label={ar ? "حذف" : "Delete"}
          className="tap grid h-[74px] w-[74px] place-items-center rounded-full text-foreground disabled:opacity-30"
        >
          <Delete className="h-6 w-6" />
        </button>
        <Key onClick={() => press("0")}>0</Key>
        <button
          type="button"
          onClick={() => submit(pin)}
          disabled={pin.length < MIN || busy}
          aria-label={t(lang, "admin_login")}
          className="tap grid h-[74px] w-[74px] place-items-center rounded-full text-[15px] font-bold text-ios-blue disabled:opacity-30"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : ar ? "دخول" : "OK"}
        </button>
      </div>
      <style>{`@keyframes shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-8px)}40%,60%{transform:translateX(8px)}}`}</style>
    </div>
  );
}

function Key({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-[74px] w-[74px] place-items-center rounded-full bg-fill text-[30px] font-medium leading-none transition active:bg-foreground/25"
    >
      {children}
    </button>
  );
}
