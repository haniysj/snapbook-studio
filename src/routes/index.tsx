import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { GalleryCarousel } from "@/components/site/GalleryCarousel";
import { PackagesGrid } from "@/components/site/PackagesGrid";
import { BookingCalendar } from "@/components/site/BookingCalendar";
import { ContactSection } from "@/components/site/ContactSection";
import { MediaImage } from "@/components/site/MediaImage";
import { useLang, useSettings } from "@/lib/app-context";
import { emailToUsername, useSession } from "@/lib/helpers";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Camera, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { lang } = useLang();
  const { settings } = useSettings();
  const session = useSession();
  const username = emailToUsername(session?.user?.email);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--gold)_25%,transparent),transparent_60%)]" />
        <div className="mx-auto max-w-6xl px-4 py-16 text-center md:py-24">
          {username && (
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-sm gold-text font-semibold">
              {t(lang, "welcome_back")}, {username} 👋
            </div>
          )}

          {settings.logo_url && (
            <div className="mx-auto mb-6 flex justify-center">
              <MediaImage
                path={settings.logo_url}
                alt={settings.site_name}
                className="h-24 w-24 rounded-full object-cover ring-2 ring-gold/60 shadow-lg md:h-28 md:w-28"
              />
            </div>
          )}

          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/5 px-4 py-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-gold" />
            <span className="text-muted-foreground">{lang === "ar" ? "استوديو تصوير احترافي" : "Professional photography studio"}</span>
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">
            <span className="gold-text">{settings.site_name}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            {t(lang, "brand_tagline")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/book">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-gold to-gold-soft text-primary-foreground hover:opacity-90">
                <Camera className="h-4 w-4" />
                {t(lang, "book_now")}
              </Button>
            </Link>
            <a href="#packages">
              <Button size="lg" variant="outline" className="border-gold/50">
                {t(lang, "nav_packages")}
              </Button>
            </a>
          </div>
        </div>
      </section>

      <GalleryCarousel />
      <BookingCalendar />
      <PackagesGrid />
      <ContactSection />

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {settings.site_name}
      </footer>
    </div>
  );
}
