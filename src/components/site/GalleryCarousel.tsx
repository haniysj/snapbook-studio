import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  useEffect(() => { setIndex(0); }, [selectedCat, images.length]);
  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), 4500);
    return () => clearInterval(id);
  }, [images.length]);

  const go = (dir: 1 | -1) => {
    if (images.length === 0) return;
    setIndex((i) => (i + dir + images.length) % images.length);
  };

  // swipe
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      const forward = lang === "ar" ? dx > 0 : dx < 0;
      go(forward ? 1 : -1);
    }
    touchStartX.current = null;
  };

  const prevDir = lang === "ar" ? 1 : -1;
  const nextDir = lang === "ar" ? -1 : 1;

  return (
    <section id="gallery" className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
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
        <div className="aspect-[16/9] animate-pulse rounded-2xl bg-muted" />
      ) : images.length === 0 ? (
        <div className="grid aspect-[16/9] place-items-center rounded-2xl border border-dashed border-border text-muted-foreground text-sm">
          {lang === "ar" ? "لم تُضف صور بعد" : "No images yet"}
        </div>
      ) : (
        <div
          className="relative overflow-hidden rounded-3xl card-elegant aspect-[16/9] select-none"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="flex h-full transition-transform duration-700 ease-out"
            style={{ transform: `translateX(${lang === "ar" ? "" : "-"}${index * 100}%)` }}
          >
            {images.map((img) => (
              <div key={img.id} className="relative h-full min-w-full">
                <MediaImage path={img.url} alt={img.title_ar ?? ""} className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                {img.title_ar && (
                  <div className="absolute bottom-4 start-4 rounded-md bg-black/50 px-3 py-1 text-sm text-white backdrop-blur-md">
                    {img.title_ar}
                  </div>
                )}
              </div>
            ))}
          </div>

          {images.length > 1 && (
            <>
              <button
                aria-label="prev"
                onClick={() => go(prevDir as 1 | -1)}
                className="absolute start-2 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                aria-label="next"
                onClick={() => go(nextDir as 1 | -1)}
                className="absolute end-2 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    aria-label={`slide ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-gold" : "w-2 bg-white/50"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
