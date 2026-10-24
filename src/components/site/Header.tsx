import { Link, useRouterState } from "@tanstack/react-router";
import { Moon, Sun, UserRound } from "lucide-react";
import { useLang, useSettings, useTheme } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { BrandLogo } from "@/components/site/BrandLogo";
import { cn } from "@/lib/utils";

export const SITE_SECTIONS = [
  { hash: "gallery", key: "nav_gallery" },
  { hash: "calendar", key: "nav_calendar" },
  { hash: "packages", key: "nav_packages" },
  { hash: "contact", key: "nav_contact" },
] as const;

/** iOS-style translucent navigation bar. */
export function Header({ title }: { title?: string }) {
  const { theme, toggle: toggleTheme } = useTheme();
  const { lang, toggle: toggleLang } = useLang();
  const { settings } = useSettings();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onHome = path === "/";

  return (
    <header className="glass hairline-b sticky top-0 z-40 w-full pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="tap flex min-w-0 items-center gap-2.5" aria-label={settings.site_name}>
          <BrandLogo className="h-9 w-auto shrink-0" shineDelay="1.8s" />
          <span className="truncate text-[15px] font-bold tracking-tight">{title ?? settings.site_name}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={lang === "ar" ? "الأقسام" : "Sections"}>
          {SITE_SECTIONS.map((s) => (
            <Link
              key={s.hash}
              to="/"
              hash={s.hash}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:bg-fill hover:text-foreground"
            >
              {t(lang, s.key)}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={toggleLang}
            className="tap grid h-9 min-w-9 place-items-center rounded-full bg-fill px-2.5 text-[13px] font-bold"
            aria-label={lang === "ar" ? "English" : "العربية"}
          >
            {lang === "ar" ? "EN" : "ع"}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="tap grid h-9 w-9 place-items-center rounded-full bg-fill"
            aria-label={lang === "ar" ? "تغيير المظهر" : "Toggle appearance"}
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <Link
            to="/admin"
            className={cn("tap grid h-9 w-9 place-items-center rounded-full bg-fill", path === "/admin" && "bg-primary text-primary-foreground")}
            aria-label={t(lang, "nav_admin")}
            title={t(lang, "nav_admin")}
          >
            <UserRound className="h-[18px] w-[18px]" />
          </Link>
          {onHome && (
            <Link
              to="/book"
              className="tap ms-1 hidden h-9 items-center rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground md:inline-flex"
            >
              {t(lang, "book_now")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
