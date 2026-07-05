import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signedMediaUrl } from "./helpers";
import type { Lang } from "./i18n";

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
};
type SettingsCtx = { settings: SiteSettings; refresh: () => Promise<void> };
const SettingsContext = createContext<SettingsCtx | null>(null);

const DEFAULT_SETTINGS: SiteSettings = {
  site_name: "Seven Photography",
  logo_url: null,
  whatsapp_number: "+96896763697",
  bank_details: "",
  instagram_url: null,
};


export function AppProviders({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [lang, setLangState] = useState<Lang>("ar");
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  // hydrate from localStorage
  useEffect(() => {
    const t = (localStorage.getItem("theme") as Theme | null) ?? "light";
    const l = (localStorage.getItem("lang") as Lang | null) ?? "ar";
    setTheme(t);
    setLangState(l);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    localStorage.setItem("lang", lang);
  }, [lang]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
    if (data) {
      setSettings({
        site_name: data.site_name,
        logo_url: data.logo_url,
        whatsapp_number: data.whatsapp_number,
        bank_details: data.bank_details ?? "",
        instagram_url: (data as any).instagram_url ?? null,
      });
    }

  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const themeCtx = useMemo<ThemeCtx>(
    () => ({ theme, toggle: () => setTheme((p) => (p === "light" ? "dark" : "light")), set: setTheme }),
    [theme],
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
