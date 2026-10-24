export type ThemeId = "classic" | "sand" | "ocean" | "rose" | "olive" | "night";

/** Site color themes (CSS lives in styles.css under html[data-theme]). */
export const THEMES: { id: ThemeId; ar: string; en: string; swatch: [string, string]; patternAr: string; patternEn: string }[] = [
  { id: "classic", ar: "كلاسيكي", en: "Classic", swatch: ["#1c1c1e", "#8e8e93"], patternAr: "نقاط ناعمة", patternEn: "Soft dots" },
  { id: "sand", ar: "رملي", en: "Desert Sand", swatch: ["#b8862b", "#e3b964"], patternAr: "نجمة عُمانية", patternEn: "Omani star" },
  { id: "ocean", ar: "بحري", en: "Ocean", swatch: ["#0e7c86", "#38b6c0"], patternAr: "أمواج", patternEn: "Waves" },
  { id: "rose", ar: "وردي", en: "Rose", swatch: ["#b5476b", "#e58aa6"], patternAr: "خطوط مائلة", patternEn: "Fine lines" },
  { id: "olive", ar: "زيتوني", en: "Olive", swatch: ["#5b7a3a", "#9bbf6a"], patternAr: "عدسات", patternEn: "Lenses" },
  { id: "night", ar: "ليلي", en: "Night", swatch: ["#4f46e5", "#8b85ff"], patternAr: "نجوم", patternEn: "Stars" },
];

export function isThemeId(v: unknown): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

export function applySiteTheme(id: string | null | undefined) {
  const theme = isThemeId(id) ? id : "classic";
  if (typeof document === "undefined") return;
  if (theme === "classic") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("site-theme", theme); } catch { /* ignore */ }
}
