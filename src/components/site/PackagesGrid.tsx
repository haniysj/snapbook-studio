import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

type Pkg = {
  id: string;
  name_ar: string; name_en: string | null;
  description_ar: string | null; description_en: string | null;
  price: number; currency: string;
  discounted_price: number | null;
  offer_expiry_date: string | null;
};

function offerActive(p: Pkg): boolean {
  if (p.discounted_price == null) return false;
  if (!p.offer_expiry_date) return true;
  return new Date(p.offer_expiry_date).getTime() > Date.now();
}

export function PackagesGrid() {
  const { lang } = useLang();
  const { data: packages = [] } = useQuery({
    queryKey: ["packages"],
    queryFn: async () =>
      ((await supabase.from("packages").select("*").eq("active", true).order("sort_order")).data ?? []) as unknown as Pkg[],
  });

  return (
    <section id="packages" className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="mb-6 text-2xl md:text-3xl font-bold gold-text text-center">{t(lang, "packages_title")}</h2>
      <div className="grid gap-5 md:grid-cols-3">
        {packages.map((p, idx) => {
          const featured = idx === 1;
          const active = offerActive(p);
          return (
            <div
              key={p.id}
              className={`card-elegant flex flex-col p-6 transition hover:-translate-y-1 hover:shadow-elegant ${featured ? "ring-2 ring-gold" : ""}`}
            >
              {featured && (
                <span className="mb-3 self-start rounded-full bg-gradient-to-r from-gold to-gold-soft px-3 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                  {lang === "ar" ? "الأكثر طلباً" : "Popular"}
                </span>
              )}
              <h3 className="text-xl font-bold font-display">{lang === "ar" ? p.name_ar : p.name_en || p.name_ar}</h3>
              <p className="mt-2 min-h-[3rem] text-sm text-muted-foreground">
                {lang === "ar" ? p.description_ar : p.description_en || p.description_ar}
              </p>
              <div className="my-4 flex flex-wrap items-baseline gap-2">
                {active ? (
                  <>
                    <span className="text-4xl font-bold gold-text">{Number(p.discounted_price).toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">{p.currency}</span>
                    <span className="text-lg text-muted-foreground line-through decoration-destructive">
                      {Number(p.price).toLocaleString()}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-4xl font-bold gold-text">{Number(p.price).toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">{p.currency}</span>
                  </>
                )}
              </div>
              {active && p.offer_expiry_date && (
                <p className="-mt-2 mb-3 text-xs text-destructive font-semibold">
                  {t(lang, "offer_expires")}: {new Date(p.offer_expiry_date).toLocaleDateString(lang === "ar" ? "ar" : "en")}
                </p>
              )}
              <ul className="mb-6 space-y-1.5 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-gold" /> {lang === "ar" ? "تصوير احترافي" : "Pro shoot"}</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-gold" /> {lang === "ar" ? "تعديل احترافي" : "Retouching"}</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-gold" /> {lang === "ar" ? "تسليم سريع" : "Fast delivery"}</li>
              </ul>
              <Link to="/book" search={{ package_id: p.id }} className="mt-auto">
                <Button className="w-full bg-gradient-to-r from-gold to-gold-soft text-primary-foreground hover:opacity-90">
                  {t(lang, "book_now")}
                </Button>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
