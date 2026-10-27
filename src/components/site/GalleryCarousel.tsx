import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ImageOff, Play, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MediaImage } from "@/components/site/MediaImage";
import { MediaVideo } from "@/components/site/MediaVideo";
import { SectionHeading } from "@/components/site/SectionHeading";
import { SegmentedControl } from "@/components/ui/segmented";
import { useLang, useSettings } from "@/lib/app-context";
import { mediaSrc } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** How long each image stays before the next one (also the progress bar's duration). */
const SLIDE_MS = 5000;

type Img = { id: string; url: string; title_ar: string | null; media_type: string; category_id: string | null };

export function GalleryCarousel() {
  const { lang } = useLang();
  const rtl = lang === "ar";
  const { data: categories = [] } = useQuery({
    queryKey: ["gallery_categories"],
    queryFn: async () => (await supabase.from("gallery_categories").select("*").order("sort_order")).data ?? [],
  });
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["gallery_images"],
    queryFn: async () =>
      ((await supabase.from("gallery_images").select("*").eq("active", true).order("sort_order")).data ?? []) as Img[],
  });

  const [cat, setCat] = useState<string>("all");
  const images = useMemo(() => (cat === "all" ? all : all.filter((i) => i.category_id === cat)), [all, cat]);
  // Only show categories that actually have items, so visitors never land on an empty tab.
  const usedCats = useMemo(() => categories.filter((c: any) => all.some((i) => i.category_id === c.id)), [categories, all]);

  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  useEffect(() => { setIndex(0); }, [cat]);

  const go = (dir: 1 | -1) => {
    if (!images.length) return;
    setIndex((i) => (i + dir + images.length) % images.length);
  };

  // Auto-advance: driven by the progress bar's CSS animation (see .slide-progress in styles.css).
  // The bar pauses while the visitor hovers / holds a finger on the photo, when the tab is in the
  // background, or when the gallery is scrolled out of view — and the slideshow pauses with it.
  const [held, setHeld] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [images.length > 0]);
  const timerPaused = held || tabHidden || offscreen;
  const next = () => setIndex((i) => (i + 1) % Math.max(images.length, 1));

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewer(false);
      if (e.key === "ArrowRight") go(rtl ? -1 : 1);
      if (e.key === "ArrowLeft") go(rtl ? 1 : -1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [viewer, rtl, images.length]);

  const swipe = useSwipe((dx) => go((rtl ? dx > 0 : dx < 0) ? 1 : -1));
  const stageHandlers = {
    onTouchStart: (e: React.TouchEvent) => { setHeld(true); swipe.onTouchStart(e); },
    onTouchEnd: (e: React.TouchEvent) => { setHeld(false); swipe.onTouchEnd(e); },
    onTouchCancel: () => setHeld(false),
    onMouseEnter: () => setHeld(true),
    onMouseLeave: () => setHeld(false),
  };
  const current = images[index];

  return (
    <section id="gallery" className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <SectionHeading title={t(lang, "gallery_title")} subtitle={lang === "ar" ? "لقطات من جلساتنا" : "Moments from our sessions"} />

      {usedCats.length > 0 && (
        <SegmentedControl
          className="mb-4"
          size="sm"
          value={cat}
          onChange={setCat}
          ariaLabel={t(lang, "category")}
          options={[
            { value: "all", label: lang === "ar" ? "الكل" : "All" },
            ...usedCats.map((c: any) => ({ value: c.id as string, label: rtl ? c.name_ar : c.name_en || c.name_ar })),
          ]}
        />
      )}

      {isLoading ? (
        <div className="aspect-[4/5] animate-pulse rounded-[1.75rem] bg-fill sm:aspect-[16/9] lg:aspect-[2/1]" />
      ) : images.length === 0 ? (
        <div className="ios-card grid aspect-[4/3] place-items-center p-6 text-center sm:aspect-[16/7]">
          <div>
            <ImageOff className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
            <p className="font-semibold">{lang === "ar" ? "ستُضاف الأعمال قريباً" : "Work coming soon"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{lang === "ar" ? "تابعنا لمشاهدة أحدث جلساتنا." : "Check back for our latest sessions."}</p>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={stage}
            className="relative aspect-[4/5] select-none overflow-hidden rounded-[1.75rem] bg-black sm:aspect-[16/9] lg:aspect-[2/1]"
            {...stageHandlers}
          >
            <div
              className="flex h-full transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
              style={{ transform: `translateX(${rtl ? "" : "-"}${index * 100}%)` }}
            >
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setViewer(true)}
                  aria-label={lang === "ar" ? "عرض بملء الشاشة" : "View full screen"}
                  className="relative h-full min-w-full cursor-zoom-in"
                >
                  {img.media_type === "video" ? (
                    <MediaVideo path={img.url} className="h-full w-full object-cover" muted playsInline loop autoPlay={i === index} preload="metadata" />
                  ) : (
                    <MediaImage path={img.url} alt={img.title_ar ?? ""} className="h-full w-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
                  )}
                </button>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 to-transparent" />
            <Watermark />
            {current?.title_ar && (
              <div className={cn("pointer-events-none absolute start-4 max-w-[70%] truncate text-sm font-semibold text-white", images.length > 1 ? "bottom-11" : "bottom-4")}>{current.title_ar}</div>
            )}
            {images.length > 1 && (
              <>
                <SlideDots
                  count={images.length}
                  index={index}
                  running={!viewer}
                  paused={timerPaused}
                  resetKey={cat}
                  onPick={setIndex}
                  onDone={next}
                  ar={rtl}
                />
                <NavButton side="start" onClick={() => go(-1)} rtl={rtl} />
                <NavButton side="end" onClick={() => go(1)} rtl={rtl} />
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`${i + 1}`}
                  className={cn(
                    "tap relative h-16 w-16 shrink-0 overflow-hidden rounded-xl transition md:h-20 md:w-20",
                    i === index ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100",
                  )}
                >
                  {img.media_type === "video" ? (
                    <>
                      <MediaVideo path={img.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                      <Play className="absolute inset-0 m-auto h-5 w-5 fill-white text-white drop-shadow" />
                    </>
                  ) : (
                    <MediaImage path={img.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {viewer && current && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-modal="true" {...swipe}>
          <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2 text-white">
            <span className="text-sm font-semibold opacity-80" dir="ltr">{index + 1} / {images.length}</span>
            <button
              type="button"
              onClick={() => setViewer(false)}
              aria-label={lang === "ar" ? "إغلاق" : "Close"}
              className="tap grid h-10 w-10 place-items-center rounded-full bg-white/15"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-2">
            <div className="relative flex max-h-full max-w-full">
              {current.media_type === "video" ? (
                <MediaVideo key={current.id} path={current.url} className="max-h-[calc(100dvh-9rem)] max-w-full rounded-lg" controls autoPlay playsInline />
              ) : (
                <MediaImage key={current.id} path={current.url} alt={current.title_ar ?? ""} className="max-h-[calc(100dvh-9rem)] max-w-full object-contain" />
              )}
              <Watermark />
            </div>
            {images.length > 1 && (
              <>
                <NavButton side="start" onClick={() => go(-1)} rtl={rtl} dark />
                <NavButton side="end" onClick={() => go(1)} rtl={rtl} dark />
              </>
            )}
          </div>
          <div className="min-h-12 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2 text-center text-sm text-white/85">
            {current.title_ar}
          </div>
        </div>
      )}
    </section>
  );
}

/** Small logo in the top-right corner of every photo/video. */
function Watermark() {
  const { settings } = useSettings();
  const src = settings.logo_url ? mediaSrc(settings.logo_url) : "/brand/logo-white.png";
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="pointer-events-none absolute right-3 top-3 h-9 w-auto max-w-[22%] select-none object-contain opacity-80 drop-shadow-[0_1px_3px_rgba(0,0,0,.55)] sm:h-11 lg:h-12"
    />
  );
}

/**
 * One dot per photo, close together, always left → right.
 * While a photo is showing, the space after its dot opens and a bar fills it from the current
 * dot to the next one; when the bar reaches the next dot the next photo appears and the space
 * collapses. The bar's CSS animation is the slideshow timer (animationend → next photo).
 * With many photos only a window of 9 dots is shown (like iOS).
 */
const WINDOW = 9;
function SlideDots({
  count, index, running, paused, resetKey, onPick, onDone, ar,
}: {
  count: number; index: number; running: boolean; paused: boolean; resetKey: string;
  onPick: (i: number) => void; onDone: () => void; ar: boolean;
}) {
  const first = count <= WINDOW ? 0 : Math.min(Math.max(index - Math.floor(WINDOW / 2), 0), count - WINDOW);
  const last = Math.min(count, first + WINDOW) - 1;
  const dots = [];
  for (let i = first; i <= last; i++) {
    const active = i === index;
    const edge = count > WINDOW && ((i === first && first > 0) || (i === last && last < count - 1));
    dots.push(
      <button
        key={`d${i}`}
        type="button"
        onClick={(e) => { e.stopPropagation(); onPick(i); }}
        aria-label={ar ? `الصورة ${i + 1}` : `Photo ${i + 1}`}
        aria-current={active ? "true" : undefined}
        className="grid h-6 w-[13px] shrink-0 place-items-center"
      >
        <span className={cn("slide-dot block h-[7px] w-[7px] rounded-full shadow-[0_0_0_.5px_rgba(0,0,0,.3)]", active ? "bg-white" : "bg-white/55", edge && "scale-[.6]")} />
      </button>,
    );
    // the opening space after the current dot (after the last dot it leads back to the first photo)
    dots.push(
      <span
        key={`g${i}`}
        aria-hidden="true"
        className={cn("slide-gap relative block h-[3px] shrink-0 overflow-hidden rounded-full bg-white/35", active && running ? "mx-0.5 w-9 sm:w-11" : "w-0")}
      >
        {active && running && (
          <span
            key={`${resetKey}-${index}`}
            className="slide-progress absolute inset-0 block rounded-full bg-white"
            style={{ ["--slide-ms" as string]: `${SLIDE_MS}ms` }}
            data-paused={paused}
            onAnimationEnd={onDone}
          />
        )}
      </span>,
    );
  }
  return (
    <div
      dir="ltr"
      className="absolute inset-x-0 bottom-2.5 flex items-center justify-center"
      role="group"
      aria-label={ar ? `الصورة ${index + 1} من ${count}` : `Photo ${index + 1} of ${count}`}
    >
      <div className="flex items-center rounded-full bg-black/25 px-2 backdrop-blur-sm">{dots}</div>
    </div>
  );
}

function NavButton({ side, onClick, rtl, dark }: { side: "start" | "end"; onClick: () => void; rtl: boolean; dark?: boolean }) {
  // "start" = previous. Arrow direction follows reading direction.
  const pointsLeft = (side === "start") !== rtl;
  const Icon = pointsLeft ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "start" ? "previous" : "next"}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "tap absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-white backdrop-blur-md sm:grid",
        dark ? "bg-white/15" : "bg-black/35",
        side === "start" ? "start-3" : "end-3",
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function useSwipe(onSwipe: (dx: number) => void) {
  const start = useRef<number | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => { start.current = e.touches[0].clientX; },
    onTouchEnd: (e: React.TouchEvent) => {
      if (start.current == null) return;
      const dx = e.changedTouches[0].clientX - start.current;
      if (Math.abs(dx) > 40) onSwipe(dx);
      start.current = null;
    },
  };
}
