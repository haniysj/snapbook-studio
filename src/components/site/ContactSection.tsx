import { ChevronLeft, ChevronRight, Instagram, Phone } from "lucide-react";
import { useLang, useSettings } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { whatsappUrl } from "@/lib/helpers";
import { SectionHeading } from "@/components/site/SectionHeading";
import { WhatsAppIcon } from "@/components/site/BrandLogo";
import type { ReactNode } from "react";

/** Contact options as an iOS grouped list. */
export function ContactSection() {
  const { lang } = useLang();
  const { settings } = useSettings();
  const wa = whatsappUrl(
    settings.whatsapp_number,
    lang === "ar" ? "مرحباً، أرغب بالاستفسار عن جلسة تصوير." : "Hi, I'd like to ask about a photography session.",
  );
  const tel = `tel:${(settings.whatsapp_number || "").replace(/[^\d+]/g, "")}`;

  return (
    <section id="contact" className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <SectionHeading title={t(lang, "contact_us")} subtitle={lang === "ar" ? "نسعد بالرد على استفساراتك" : "We're happy to help"} />
      <div className="ios-group ios-divide mx-auto max-w-md">
        <Row href={wa} icon={<WhatsAppIcon className="h-[18px] w-[18px]" />} tint="bg-[#25D366]" title="WhatsApp" detail={settings.whatsapp_number} external />
        <Row href={tel} icon={<Phone className="h-[17px] w-[17px]" />} tint="bg-ios-green" title={lang === "ar" ? "اتصال" : "Call"} detail={settings.whatsapp_number} />
        {settings.instagram_url && (
          <Row
            href={settings.instagram_url}
            icon={<Instagram className="h-[17px] w-[17px]" />}
            tint="bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]"
            title={lang === "ar" ? "انستقرام" : "Instagram"}
            detail={instagramHandle(settings.instagram_url)}
            external
          />
        )}
      </div>
    </section>
  );
}

function instagramHandle(url: string) {
  const m = url.match(/instagram\.com\/([^/?#]+)/i);
  return m ? `@${m[1]}` : url;
}

function Row({ href, icon, tint, title, detail, external }: { href: string; icon: ReactNode; tint: string; title: string; detail?: string | null; external?: boolean }) {
  const { lang } = useLang();
  const Chevron = lang === "ar" ? ChevronLeft : ChevronRight;
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="ios-row tap hover:bg-fill/60"
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-white ${tint}`}>{icon}</span>
      <span className="flex-1 font-semibold">{title}</span>
      {detail && <span className="truncate text-sm text-muted-foreground" dir="ltr">{detail}</span>}
      <Chevron className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    </a>
  );
}
