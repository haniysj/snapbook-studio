import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaImage } from "@/components/site/MediaImage";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";

export function GalleryCarousel() {
  const { lang } = useLang();
  const { data: categories = [] } = useQuery({
    queryKey: ["gallery_categories"],
    queryFn: async () => (await supabase.from("gallery_categories").select("*").order("sort_order")).data ?? [],
  });
  const [selectedCat, setSelectedCat] = useState<string | "all">("all");

  const { data: images = [], isLoading } = useQuery({
    queryKey: ["gallery_images", selectedCat],
    queryFn: async () => {
      let q = supabase.from("gallery_images").select("*").eq("active", true).order("sort_order");
      if (selectedCat !== "all") q = q.eq("category_id", selectedCat);
      return (await q).data ?? [];
    },
  });

  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), 3500);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <section id="gallery" className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-2xl md:text-3xl font-bold gold-text">{t(lang, "gallery_title")}</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCat("all")}
            className={`rounded-full border px-3 py-1 text-xs transition ${selectedCat === "all" ? "border-gold bg-gold/15 text-foreground" : "border-border text-muted-foreground hover:border-gold/50"}`}
          >
            {lang === "ar" ? "الكل" : "All"}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={`rounded-full border px-3 py-1 text-xs transition ${selectedCat === c.id ? "border-gold bg-gold/15 text-foreground" : "border-border text-muted-foreground hover:border-gold/50"}`}
            >
              {lang === "ar" ? c.name_ar : c.name_en || c.name_ar}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      ) : images.length === 0 ? (
        <div className="grid h-64 place-items-center rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
          {lang === "ar" ? "لم تُضف صور بعد" : "No images yet"}
        </div>
      ) : (
        <>
          {/* Featured slider */}
          <div className="relative overflow-hidden rounded-3xl card-elegant">
            <div
              className="flex transition-transform duration-700 ease-out"
              style={{ transform: `translateX(${lang === "ar" ? "" : "-"}${index * 100}%)` }}
            >
              {images.map((img) => (
                <div key={img.id} className="relative min-w-full">
                  <img
                    src={publicMediaUrl(img.url)}
                    alt={img.title_ar ?? ""}
                    className="h-[380px] w-full object-cover md:h-[520px]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  {img.title_ar && (
                    <div className="absolute bottom-4 start-4 rounded-md bg-black/50 px-3 py-1 text-sm text-white backdrop-blur-md">
                      {img.title_ar}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="absolute bottom-4 end-4 flex gap-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-gold" : "w-2 bg-white/50"}`}
                />
              ))}
            </div>
          </div>

          {/* Thumb grid */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.slice(0, 8).map((img, i) => (
              <button
                key={img.id}
                onClick={() => setIndex(i)}
                className={`relative aspect-square overflow-hidden rounded-xl ring-1 transition ${i === index ? "ring-gold" : "ring-border hover:ring-gold/50"}`}
              >
                <img src={publicMediaUrl(img.url)} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
