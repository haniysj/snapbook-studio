import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeading } from "@/components/site/SectionHeading";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type Pkg = {
  id: string;
  name_ar: string; name_en: string | null;
  description_ar: string | null; description_en: string | null;
  price: number; currency: string;
  discounted_price: number | null;
  offer_expiry_date: string | null;
};

export function offerActive(p: Pkg): boolean {
  if (p.discounted_price == null) return false;
  if (!p.offer_expiry_date) return true;
  return new Date(p.offer_expiry_date).getTime() > Date.now();
}

/** "A + B + C" (or one item per line) → ["A","B","C"] so descriptions read as a checklist. */
export function features(text: string | null | undefined): string[] {
  return (text ?? "").split(/\s*[+\n•،]\s*|\s+-\s+/).map((s) => s.trim()).filter(Boolean);
}

export function formatPrice(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

export function usePackages() {
  return useQuery({
    queryKey: ["packages"],
    queryFn: async () =>
      ((await supabase.from("packages").select("*").eq("active", true).order("sort_order")).data ?? []) as unknown as Pkg[],
  });
}

export function PackagesGrid() {
  const { lang } = useLang();
  const { data: packages = [], isLoading } = usePackages();
  const featuredIndex = packages.length >= 3 ? 1 : -1;

  return (
    <section id="packages" className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <SectionHeading title={t(lang, "packages_title")} subtitle={lang === "ar" ? "اختر ما يناسب مناسبتك" : "Pick what suits your occasion"} />
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-64 animate-pulse rounded-[1.25rem] bg-fill" />)}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {packages.map((p, idx) => {
            const featured = idx === featuredIndex;
            const offer = offerActive(p);
            const name = lang === "ar" ? p.name_ar : p.name_en || p.name_ar;
            const items = features(lang === "ar" ? p.description_ar : p.description_en || p.description_ar);
            return (
              <article
                key={p.id}
                className={cn(
                  "flex flex-col rounded-[1.25rem] p-5 transition md:p-6",
                  featured ? "brand-gradient text-white shadow-[0_18px_40px_-18px_var(--brand)]" : "ios-card",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-extrabold">{name}</h3>
                  {featured && (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">
                      <Sparkles className="h-3 w-3" /> {lang === "ar" ? "الأكثر طلباً" : "Popular"}
                    </span>
                  )}
                  {!featured && offer && (
                    <span className="whitespace-nowrap rounded-full bg-ios-orange/15 px-2.5 py-0.5 text-[11px] font-bold text-ios-orange">
                      {lang === "ar" ? "عرض" : "Offer"}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-4xl font-extrabold tracking-tight">{formatPrice(offer ? p.discounted_price : p.price)}</span>
                  <span className={cn("text-sm font-semibold", featured ? "opacity-70" : "text-muted-foreground")}>{p.currency}</span>
                  {offer && <span className={cn("text-base line-through", featured ? "opacity-60" : "text-muted-foreground")}>{formatPrice(p.price)}</span>}
                </div>
                {offer && p.offer_expiry_date && (
                  <p className={cn("mt-1 text-xs font-semibold", featured ? "opacity-80" : "text-ios-orange")}>
                    {t(lang, "offer_expires")}: {new Date(p.offer_expiry_date).toLocaleDateString(lang === "ar" ? "ar-OM" : "en-GB", { day: "numeric", month: "long" })}
                  </p>
                )}

                {items.length > 0 && (
                  <ul className="mt-4 space-y-2 text-[14px]">
                    {items.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", featured ? "bg-white/20" : "bg-fill")}>
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-auto pt-6">
                  <Link
                    to="/book"
                    search={{ package_id: p.id }}
                    className={cn(
                      "tap flex h-11 items-center justify-center rounded-full text-[15px] font-bold",
                      featured ? "bg-white text-black" : "bg-primary text-primary-foreground",
                    )}
                  >
                    {lang === "ar" ? "اختر هذه الباقة" : "Choose this package"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
