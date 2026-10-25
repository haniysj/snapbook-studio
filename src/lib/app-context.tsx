import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signedMediaUrl } from "./helpers";
import type { Lang } from "./i18n";
import { applySiteTheme } from "./themes";

/* -------- Theme -------- */
type Theme = "light" | "dark";
type ThemeCtx = { theme: Theme; toggle: () => void; set: (t: Theme) => void };
const ThemeContext = createContext<ThemeCtx | null>(null);

/* -------- Language -------- */
type LangCtx = { lang: Lang; setLang: (l: Lang) => void; toggle: () => void };
const LangContext = createContext<LangCtx | null>(null);

/* -------- Settings -------- */
export type SiteSettings = {
  site_name: string;
  logo_url: string | null;
  whatsapp_number: string;
  bank_details: string;
  instagram_url: string | null;
  theme: string;
  invoice_header: string;
  invoice_footer: string;
  quote_header: string;
  quote_footer: string;
  quote_contact_link: string;
  quote_letterhead: boolean;
  invoice_letterhead: boolean;
};
type SettingsCtx = { settings: SiteSettings; refresh: () => Promise<void> };
const SettingsContext = createContext<SettingsCtx | null>(null);

const DEFAULT_SETTINGS: SiteSettings = {
  site_name: "Seven Photography",
  logo_url: null,
  whatsapp_number: "+96896763697",
  bank_details: "",
  instagram_url: null,
  theme: "sage",
  invoice_header: "",
  invoice_footer: "",
  quote_header: "",
  quote_footer: "",
  quote_contact_link: "sevenn.om",
  quote_letterhead: true,
  invoice_letterhead: false,
};


export function AppProviders({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [lang, setLangState] = useState<Lang>("ar");
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Theme follows the phone's light/dark setting until the visitor picks one explicitly.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("theme"); } catch { /* ignore */ }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setThemeState((saved as Theme | null) ?? (mq.matches ? "dark" : "light"));
    let l: string | null = null;
    try { l = localStorage.getItem("lang"); } catch { /* ignore */ }
    setLangState(l === "en" ? "en" : "ar");
    setHydrated(true);
    const onChange = (e: MediaQueryListEvent) => {
      let explicit: string | null = null;
      try { explicit = localStorage.getItem("theme"); } catch { /* ignore */ }
      if (!explicit) setThemeState(e.matches ? "dark" : "light");
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    try { localStorage.setItem("lang", lang); } catch { /* ignore */ }
  }, [lang, hydrated]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem("theme", t); } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
    if (data) {
      setSettings({
        site_name: data.site_name,
        logo_url: data.logo_url,
        whatsapp_number: data.whatsapp_number,
        bank_details: data.bank_details ?? "",
        instagram_url: (data as any).instagram_url ?? null,
        theme: (data as any).theme ?? "sage",
        invoice_header: (data as any).invoice_header ?? "",
        invoice_footer: (data as any).invoice_footer ?? "",
        quote_header: (data as any).quote_header ?? "",
        quote_footer: (data as any).quote_footer ?? "",
        quote_contact_link: (data as any).quote_contact_link ?? "sevenn.om",
        quote_letterhead: (data as any).quote_letterhead ?? true,
        invoice_letterhead: (data as any).invoice_letterhead ?? false,
      });
      setSettingsLoaded(true);
    }

  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Site color theme chosen in Settings (cached in localStorage for a flash-free first paint)
  useEffect(() => { if (hydrated && settingsLoaded) applySiteTheme(settings.theme); }, [settings.theme, hydrated, settingsLoaded]);

  // Sync favicon + document title with site settings (logo + name)
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (settings.site_name) document.title = settings.site_name;
    let cancelled = false;
    (async () => {
      // Default brand icons ship in /public; only swap them when a custom logo was uploaded.
      const href = settings.logo_url ? await signedMediaUrl(settings.logo_url) : "";
      if (cancelled || !href) return;
      const head = document.head;
      head.querySelectorAll("link[rel~='icon']").forEach((el) => el.parentElement?.removeChild(el));
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = href;
      head.appendChild(link);
      const apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      apple.href = href;
      head.appendChild(apple);
    })();
    return () => { cancelled = true; };
  }, [settings.logo_url, settings.site_name]);

  const themeCtx = useMemo<ThemeCtx>(
    () => ({ theme, toggle: () => setTheme(theme === "light" ? "dark" : "light"), set: setTheme }),
    [theme, setTheme],
  );
  const langCtx = useMemo<LangCtx>(
    () => ({ lang, setLang: setLangState, toggle: () => setLangState((p) => (p === "ar" ? "en" : "ar")) }),
    [lang],
  );
  const settingsCtx = useMemo<SettingsCtx>(() => ({ settings, refresh }), [settings, refresh]);

  return (
    <ThemeContext.Provider value={themeCtx}>
      <LangContext.Provider value={langCtx}>
        <SettingsContext.Provider value={settingsCtx}>{children}</SettingsContext.Provider>
      </LangContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error("useTheme outside AppProviders");
  return c;
}
export function useLang() {
  const c = useContext(LangContext);
  if (!c) throw new Error("useLang outside AppProviders");
  return c;
}
export function useSettings() {
  const c = useContext(SettingsContext);
  if (!c) throw new Error("useSettings outside AppProviders");
  return c;
}
