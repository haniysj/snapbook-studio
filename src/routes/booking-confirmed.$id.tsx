import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Copy } from "lucide-react";
import { Header } from "@/components/site/Header";
import { useLang, useSettings } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { whatsappUrl } from "@/lib/helpers";

export const Route = createFileRoute("/booking-confirmed/$id")({
  component: BookingConfirmed,
});

function BookingConfirmed() {
  const { id } = Route.useParams();
  const { lang } = useLang();
  const { settings } = useSettings();

  const copyBank = () => {
    navigator.clipboard.writeText(settings.bank_details);
    toast.success(lang === "ar" ? "تم النسخ" : "Copied");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-gold to-gold-soft text-primary-foreground shadow-elegant">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="font-display text-3xl font-bold gold-text">{t(lang, "booking_success")}</h1>
        <p className="mt-3 text-muted-foreground">{t(lang, "booking_success_desc")}</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">#{id.slice(0, 8).toUpperCase()}</p>

        <div className="card-elegant mt-8 p-6 text-start">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{t(lang, "bank_details")}</h2>
            <Button variant="ghost" size="sm" onClick={copyBank} className="gap-1">
              <Copy className="h-3.5 w-3.5" /> {lang === "ar" ? "نسخ" : "Copy"}
            </Button>
          </div>
          <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">{settings.bank_details || "—"}</pre>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={whatsappUrl(
              settings.whatsapp_number,
              lang === "ar"
                ? `مرحباً، تم حجز موعد جلسة تصوير برقم #${id.slice(0, 8).toUpperCase()}. مرفق إيصال الإيداع.`
                : `Hi, I made booking #${id.slice(0, 8).toUpperCase()}. Deposit receipt attached.`,
            )}
            target="_blank"
            rel="noreferrer"
          >
            <Button className="bg-[oklch(0.6_0.18_150)] text-white hover:opacity-90">
              {t(lang, "send_via_whatsapp")}
            </Button>
          </a>
          <Link to="/"><Button variant="outline">{t(lang, "back_home")}</Button></Link>
        </div>
      </div>
    </div>
  );
}
