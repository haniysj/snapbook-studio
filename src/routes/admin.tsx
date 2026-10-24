import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import { Header } from "@/components/site/Header";
import { useLang, useSettings } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { MediaImage } from "@/components/site/MediaImage";
import { KeyRound, Loader2, LogIn } from "lucide-react";


export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { lang } = useLang();
  const { settings } = useSettings();


  const [session, setSession] = useState<import("@/integrations/supabase/client").Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setIsAdmin(!!s?.user);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsAdmin(!!data.session?.user);
      setChecking(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <LoginCard />
      </div>
    );
  }

  const adminName = session?.user?.user_metadata.display_name ?? "";
  const isSuper = !!session?.user?.user_metadata.is_super;
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-sm gold-text font-semibold">
          {t(lang, "welcome_back")}، {adminName} · {isSuper ? (lang === "ar" ? "المشرف العام" : "General supervisor") : (lang === "ar" ? "مشرف" : "Supervisor")}
        </div>
      </div>
      <AdminDashboard isSuper={isSuper} />
    </div>
  );


  function LoginCard() {
    const [pin, setPin] = useState("");
    const [loading, setLoading] = useState(false);

    const doLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!/^\d{6,12}$/.test(pin)) {
        return toast.error(lang === "ar" ? "الرقم السري من 6 إلى 12 رقماً" : "PIN must be 6–12 digits");
      }
      setLoading(true);
      const { error } = await supabase.auth.signInWithPin(pin);
      setLoading(false);
      if (error) {
        setPin("");
        if (error.message === "locked") {
          return toast.error(lang === "ar" ? "محاولات كثيرة خاطئة. حاول بعد 15 دقيقة." : "Too many wrong attempts. Try again in 15 minutes.");
        }
        return toast.error(lang === "ar" ? "الرقم السري غير صحيح" : "Incorrect PIN");
      }
    };

    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <div className="card-elegant p-8">
          <div className="mb-5 flex flex-col items-center gap-3">
            {settings.logo_url && (
              <MediaImage
                path={settings.logo_url}
                alt={settings.site_name}
                className="h-20 w-20 rounded-full object-cover ring-2 ring-gold/50 shadow-md"
              />
            )}
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold gold-text">
              <LogIn className="h-5 w-5" /> {settings.site_name}
            </h1>
            <p className="text-center text-xs text-muted-foreground">
              {lang === "ar" ? "أدخل الرقم السري للدخول إلى لوحة التحكم." : "Enter your PIN to open the dashboard."}
            </p>
          </div>

          <form onSubmit={doLogin} className="space-y-4">
            <div>
              <Label htmlFor="pin" className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-gold" /> {lang === "ar" ? "الرقم السري" : "PIN"}
              </Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                autoComplete="current-password"
                autoFocus
                dir="ltr"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-[0.5em] font-semibold"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-gold to-gold-soft text-primary-foreground">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t(lang, "admin_login")}
            </Button>
          </form>
        </div>
      </div>
    );
  }
}
