import { useState } from "react";
import { CalendarCheck, Images, LogOut, Package, Settings, ShieldCheck, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase, type Session } from "@/integrations/supabase/client";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { SegmentedControl } from "@/components/ui/segmented";
import { BookingsTab } from "./tabs/BookingsTab";
import { PackagesTab } from "./tabs/PackagesTab";
import { GalleryTab } from "./tabs/GalleryTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { UsersTab } from "./tabs/UsersTab";
import { cn } from "@/lib/utils";

type TabId = "bookings" | "packages" | "gallery" | "settings" | "users";

export function AdminDashboard({ session }: { session: Session }) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const isSuper = !!session.user.user_metadata.is_super;
  const [tab, setTab] = useState<TabId>("bookings");

  // pending count for the badge
  const { data: pending = 0 } = useQuery({
    queryKey: ["admin_bookings"],
    queryFn: async () => (await supabase.from("bookings").select("*, packages(name_ar, name_en, price, currency)").order("created_at", { ascending: false })).data ?? [],
    select: (rows: any[]) => rows.filter((r) => r.status === "pending").length,
  });

  const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    { id: "bookings", label: t(lang, "tab_bookings"), icon: CalendarCheck },
    { id: "packages", label: t(lang, "tab_packages"), icon: Package },
    { id: "gallery", label: t(lang, "tab_gallery"), icon: Images },
    { id: "settings", label: t(lang, "tab_settings"), icon: Settings },
    ...(isSuper ? [{ id: "users" as TabId, label: ar ? "المشرفون" : "Supervisors", icon: Users }] : []),
  ];

  const badge = (id: TabId) =>
    id === "bookings" && pending > 0 ? (
      <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ios-red px-1 text-[11px] font-bold text-white">{pending}</span>
    ) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 md:pb-12">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{t(lang, "welcome_back")}</div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-extrabold">{session.user.user_metadata.display_name}</h1>
            <span className={cn(
              "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold",
              isSuper ? "bg-primary text-primary-foreground" : "bg-fill",
            )}>
              {isSuper && <ShieldCheck className="h-3 w-3" />}
              {isSuper ? (ar ? "المشرف العام" : "General supervisor") : ar ? "مشرف" : "Supervisor"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="tap inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-ios-red/12 px-3.5 text-sm font-bold text-ios-red sm:px-4"
          aria-label={t(lang, "sign_out")}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{t(lang, "sign_out")}</span>
        </button>
      </div>

      {/* tablets/desktop: segmented control */}
      <SegmentedControl
        className="mb-5 hidden md:block"
        value={tab}
        onChange={setTab}
        options={tabs.map((x) => ({ value: x.id, label: <><x.icon className="h-4 w-4" />{x.label}</>, badge: badge(x.id) }))}
      />

      <div key={tab} className="rise">
        {tab === "bookings" && <BookingsTab />}
        {tab === "packages" && <PackagesTab />}
        {tab === "gallery" && <GalleryTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "users" && isSuper && <UsersTab />}
      </div>

      {/* phones: bottom tab bar */}
      <nav className="glass hairline-t fixed inset-x-0 bottom-0 z-40 pb-safe md:hidden" aria-label={t(lang, "admin_dashboard")}>
        <div className="mx-auto grid max-w-md px-1 pt-1.5" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }}>
          {tabs.map((x) => {
            const active = tab === x.id;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => { setTab(x.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className={cn("tap relative flex flex-col items-center gap-0.5 py-1 text-[10.5px] font-semibold", active ? "text-foreground" : "text-muted-foreground")}
              >
                <x.icon className="h-6 w-6" strokeWidth={active ? 2.4 : 1.8} />
                <span className="truncate">{x.label}</span>
                {x.id === "bookings" && pending > 0 && (
                  <span className="absolute top-0 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-ios-red px-1 text-[10px] font-bold text-white ltr:left-[calc(50%+6px)] rtl:right-[calc(50%+6px)]">{pending}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
