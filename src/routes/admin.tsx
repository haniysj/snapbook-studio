import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { emailToUsername, usernameToEmail } from "@/lib/helpers";
import { toast } from "sonner";
import { Header } from "@/components/site/Header";
import { useLang, useSettings } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { MediaImage } from "@/components/site/MediaImage";
import { Loader2, LogIn } from "lucide-react";


export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { lang } = useLang();
  const { settings } = useSettings();


  const [session, setSession] = useState<import("@supabase/supabase-js").Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        supabase.rpc("is_admin", { _user_id: s.user.id }).then(({ data }) => setIsAdmin(!!data));
      } else {
        setIsAdmin(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        supabase.rpc("is_admin", { _user_id: data.session.user.id }).then(({ data: ok }) => {
          setIsAdmin(!!ok);
          setChecking(false);
        });
      } else {
        setChecking(false);
      }
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

  const adminUsername = emailToUsername(session?.user?.email);
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-sm gold-text font-semibold">
          {t(lang, "welcome_back")}, {adminUsername} 👋
        </div>
      </div>
      <AdminDashboard />
    </div>
  );


  function LoginCard() {
    const [u, setU] = useState("");
    const [p, setP] = useState("");
    const [loading, setLoading] = useState(false);

    const doLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(u),
        password: p,
      });
      setLoading(false);
      if (error) return toast.error(lang === "ar" ? "بيانات الدخول غير صحيحة" : error.message);
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: ok } = await supabase.rpc("is_admin", { _user_id: userData.user.id });
        if (!ok) {
          await supabase.auth.signOut();
          toast.error(lang === "ar" ? "ليس لديك صلاحيات إدارية" : "No admin access");
        }
      }
    };

    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="card-elegant p-8">
          <div className="mb-4 flex flex-col items-center gap-3">
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
            <p className="text-xs text-muted-foreground">
              {lang === "ar" ? "الرجاء تسجيل الدخول للوصول إلى لوحة التحكم." : "Please sign in to access the dashboard."}
            </p>
          </div>

          <form onSubmit={doLogin} className="space-y-4">
            <div>
              <Label>{t(lang, "admin_username")}</Label>
              <Input value={u} onChange={(e) => setU(e.target.value)} required autoComplete="username" />
            </div>
            <div>
              <Label>{t(lang, "admin_password")}</Label>
              <Input type="password" value={p} onChange={(e) => setP(e.target.value)} required autoComplete="current-password" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-gold to-gold-soft text-primary-foreground">
              {loading ? "..." : t(lang, "admin_login")}
            </Button>
          </form>
        </div>
      </div>
    );
  }
}
