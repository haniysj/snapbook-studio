import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteChrome";
import { GalleryCarousel } from "@/components/site/GalleryCarousel";
import { PackagesGrid } from "@/components/site/PackagesGrid";
import { BookingCalendar } from "@/components/site/BookingCalendar";
import { ContactSection } from "@/components/site/ContactSection";
import { BrandLogo } from "@/components/site/BrandLogo";
import { useLang, useSettings } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { CalendarPlus, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { lang } = useLang();
  const { settings } = useSettings();

  return (
    <SiteShell>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-5 pb-10 pt-10 text-center md:pb-16 md:pt-16">
          <div className="rise">
            <BrandLogo className="mx-auto h-40 w-auto md:h-56" />
          </div>
          <h1 className="rise large-title mt-6 md:text-5xl" style={{ animationDelay: "80ms" }}>
            {settings.site_name}
          </h1>
          <p className="rise mt-2 max-w-md text-[15px] text-muted-foreground md:text-lg" style={{ animationDelay: "140ms" }}>
            {t(lang, "brand_tagline")}
          </p>
          <div className="rise mt-7 flex w-full max-w-sm flex-col gap-2.5 sm:w-auto sm:max-w-none sm:flex-row" style={{ animationDelay: "200ms" }}>
            <Link
              to="/book"
              className="tap inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-[15px] font-bold text-primary-foreground"
            >
              <CalendarPlus className="h-[18px] w-[18px]" />
              {t(lang, "book_now")}
            </Link>
            <Link
              to="/"
              hash="packages"
              className="tap inline-flex h-12 items-center justify-center rounded-full bg-fill px-7 text-[15px] font-bold"
            >
              {lang === "ar" ? "اطّلع على الباقات" : "See packages"}
            </Link>
          </div>
          <Link to="/" hash="gallery" className="mt-8 text-muted-foreground" aria-label={t(lang, "nav_gallery")}>
            <ChevronDown className="h-6 w-6 animate-bounce" />
          </Link>
        </div>
      </section>

      <GalleryCarousel />
      <BookingCalendar />
      <PackagesGrid />
      <ContactSection />
    </SiteShell>
  );
}
