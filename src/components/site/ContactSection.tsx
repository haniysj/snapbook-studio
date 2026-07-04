import { Instagram, MessageCircle } from "lucide-react";
import { useLang, useSettings } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { whatsappUrl } from "@/lib/helpers";

export function ContactSection() {
  const { lang } = useLang();
  const { settings } = useSettings();
  const href = whatsappUrl(
    settings.whatsapp_number,
    lang === "ar" ? "مرحباً، أرغب بالاستفسار عن جلسة تصوير." : "Hi, I'd like to enquire about a photography session.",
  );
  return (
    <section id="contact" className="mx-auto max-w-6xl px-4 py-14">
      <div className="card-elegant flex flex-col items-center gap-4 p-8 text-center md:p-12">
        <h2 className="text-2xl md:text-3xl font-bold gold-text">{t(lang, "contact_us")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {lang === "ar"
            ? "لأي استفسار أو حجز خاص، تواصل معنا مباشرة عبر الواتساب أو الانستقرام."
            : "For inquiries or private bookings, reach us on WhatsApp or Instagram."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[oklch(0.6_0.18_150)] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
          >
            <MessageCircle className="h-5 w-5" />
            {t(lang, "send_via_whatsapp")}
          </a>
          {settings.instagram_url && (
            <a
              href={settings.instagram_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
            >
              <Instagram className="h-5 w-5" />
              {lang === "ar" ? "انستقرام" : "Instagram"}
            </a>
          )}
        </div>
        <span dir="ltr" className="text-xs text-muted-foreground">{settings.whatsapp_number}</span>
      </div>
    </section>
  );
}
