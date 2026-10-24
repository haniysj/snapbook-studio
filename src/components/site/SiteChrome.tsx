import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, CalendarPlus, House, Images, Package } from "lucide-react";
import { useLang, useSettings } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { whatsappUrl } from "@/lib/helpers";
import { Header } from "@/components/site/Header";
import { WhatsAppIcon } from "@/components/site/BrandLogo";
import { cn } from "@/lib/utils";

/** Public page frame: nav bar, content, footer, phone tab bar and the floating WhatsApp button. */
export function SiteShell({ children, title }: { children: ReactNode; title?: string }) {
  const { settings } = useSettings();
  return (
    <div className="min-h-dvh bg-background">
      <Header title={title} />
      <main className="mb-tabbar md:mb-0">{children}</main>
      <footer className="mb-tabbar px-4 pb-8 pt-4 text-center text-xs text-muted-foreground md:mb-0">
        <div>© {new Date().getFullYear()} {settings.site_name}</div>
        <div className="mt-1 opacity-70" dir="ltr">Prepared by: Hani Al Ghatrifi</div>
      </footer>
      <TabBar />
      <WhatsAppFab />
    </div>
  );
}

/** Floating WhatsApp button — always on the right side, above the phone tab bar. */
export function WhatsAppFab() {
  const { lang } = useLang();
  const { settings } = useSettings();
  if (!settings.whatsapp_number) return null;
  const href = whatsappUrl(
    settings.whatsapp_number,
    lang === "ar" ? "مرحباً، أرغب بالاستفسار عن جلسة تصوير." : "Hi, I'd like to ask about a photography session.",
  );
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={lang === "ar" ? "تواصل عبر واتساب" : "Chat on WhatsApp"}
      title={lang === "ar" ? "تواصل عبر واتساب" : "Chat on WhatsApp"}
      className="tap pulse-ring fixed right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_-8px_rgba(37,211,102,0.65)] bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6 md:right-6"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}

const TABS = [
  { id: "home", hash: undefined, icon: House, key: "nav_home" },
  { id: "gallery", hash: "gallery", icon: Images, key: "nav_gallery" },
  { id: "calendar", hash: "calendar", icon: CalendarDays, key: "nav_calendar" },
  { id: "packages", hash: "packages", icon: Package, key: "nav_packages" },
] as const;

/** iPhone-style bottom tab bar (phones only). */
function TabBar() {
  const { lang } = useLang();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const active = useActiveSection(path === "/");

  return (
    <nav
      className="glass hairline-t fixed inset-x-0 bottom-0 z-40 pb-safe md:hidden"
      aria-label={lang === "ar" ? "التنقل" : "Navigation"}
    >
      <div className="mx-auto grid max-w-md grid-cols-5 px-1 pt-1.5">
        {TABS.map((tab) => {
          const isActive = path === "/" && active === tab.id;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              to="/"
              hash={tab.hash}
              onClick={() => { if (!tab.hash && path === "/") window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={cn(
                "tap flex flex-col items-center gap-0.5 rounded-xl py-1 text-[10.5px] font-semibold",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={isActive ? 2.4 : 1.8} />
              {t(lang, tab.key)}
            </Link>
          );
        })}
        <Link
          to="/book"
          className={cn(
            "tap flex flex-col items-center gap-0.5 rounded-xl py-1 text-[10.5px] font-bold",
            path === "/book" ? "text-foreground" : "text-foreground/90",
          )}
        >
          <span className="grid h-6 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
            <CalendarPlus className="h-4 w-4" />
          </span>
          {lang === "ar" ? "احجز" : "Book"}
        </Link>
      </div>
    </nav>
  );
}

/** Which home section is on screen (for the tab bar highlight). */
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState("home");
  useEffect(() => {
    if (!enabled) return;
    const ids = ["gallery", "calendar", "packages", "contact"];
    const onScroll = () => {
      let current = "home";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.45) current = id === "contact" ? "packages" : id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);
  return active;
}
