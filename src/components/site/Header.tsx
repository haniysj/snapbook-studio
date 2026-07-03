import { Link } from "@tanstack/react-router";
import { Moon, Sun, Languages, LayoutDashboard, Camera } from "lucide-react";
import { useLang, useSettings, useTheme } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/site/MediaImage";


export function Header() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { lang, toggle: toggleLang } = useLang();
  const { settings } = useSettings();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          {settings.logo_url ? (
            <MediaImage path={settings.logo_url} alt={settings.site_name} className="h-9 w-9 rounded-full object-cover ring-1 ring-gold/40" />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-gold to-gold-soft text-primary-foreground">
              <Camera className="h-4 w-4" />
            </span>
          )}
          <span className="font-display text-lg font-bold gold-text tracking-wide">
            {settings.site_name}
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleLang} aria-label="Language">
            <Languages className="h-4 w-4" />
            <span className="sr-only">{lang === "ar" ? "EN" : "AR"}</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Link to="/admin">
            <Button variant="outline" size="sm" className="gap-2 border-gold/50">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">{t(lang, "nav_admin")}</span>
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
