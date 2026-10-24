import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { SiteShell } from "@/components/site/SiteChrome";
import { WhatsAppIcon } from "@/components/site/BrandLogo";
import { useLang, useSettings } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { whatsappUrl } from "@/lib/helpers";
import type { BookingSummary } from "./book";

export const Route = createFileRoute("/booking-confirmed/$id")({
  component: BookingConfirmed,
});

function BookingConfirmed() {
  const { id } = Route.useParams();
  const { lang } = useLang();
  const ar = lang === "ar";
  const { settings } = useSettings();
  const ref = `#${id.slice(0, 8).toUpperCase()}`;
  const [summary, setSummary] = useState<BookingSummary | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`booking:${id}`);
      if (raw) setSummary(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [id]);

  const msg = summary
    ? ar
      ? `طلب حجز جديد ${ref}\n\nالاسم: ${summary.name}\nالهاتف: ${summary.phone}\nالتاريخ: ${summary.date}\nالوقت: ${summary.time}\nالباقة: ${summary.pkg}${summary.location ? `\nالموقع: ${summary.location}` : ""}${summary.notes ? `\nملاحظات: ${summary.notes}` : ""}\n\nمرفق إيصال الدفعة المقدمة.`
      : `New booking request ${ref}\n\nName: ${summary.name}\nPhone: ${summary.phone}\nDate: ${summary.date}\nTime: ${summary.time}\nPackage: ${summary.pkg}${summary.location ? `\nLocation: ${summary.location}` : ""}${summary.notes ? `\nNotes: ${summary.notes}` : ""}\n\nAdvance payment receipt attached.`
    : ar
      ? `مرحباً، أرسلت طلب حجز برقم ${ref}. مرفق إيصال الدفعة المقدمة.`
      : `Hi, I sent booking request ${ref}. Advance payment receipt attached.`;

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(ar ? `تم نسخ ${label}` : `${label} copied`); }
    catch { toast.error(ar ? "تعذّر النسخ" : "Couldn't copy"); }
  };

  return (
    <SiteShell>
      <div className="mx-auto max-w-xl px-4 pb-10 pt-10">
        <div className="rise text-center">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-ios-green text-white shadow-[0_12px_32px_-10px_var(--ios-green)]">
            <Check className="h-10 w-10" strokeWidth={3} />
          </div>
          <h1 className="large-title">{t(lang, "booking_success")}</h1>
          <p className="mx-auto mt-2 max-w-sm text-[15px] text-muted-foreground">{t(lang, "booking_success_desc")}</p>
          <button
            type="button"
            onClick={() => copy(ref, ar ? "رمز الحجز" : "Booking code")}
            className="tap mt-4 inline-flex items-center gap-2 rounded-full bg-fill px-4 py-1.5 text-sm"
          >
            <span className="text-muted-foreground">{ar ? "رمز الحجز" : "Booking code"}</span>
            <span className="font-mono font-bold" dir="ltr">{ref}</span>
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="mt-8 space-y-6">
          <div>
            <p className="mb-2 px-1 text-[15px] font-semibold leading-7">{ar ? "١. يرجى التكرم بتحويل دفعة مقدمة إلى الرقم التالي المرتبط بالحساب (لتأكيد الحجز)." : "1. Kindly transfer an advance payment to the following number linked to the account (to confirm the booking)."}</p>
            <div className="ios-group">
              <pre className="whitespace-pre-wrap px-4 py-3.5 font-sans text-[15px] leading-7">{settings.bank_details || "—"}</pre>
              {settings.bank_details && (
                <button
                  type="button"
                  onClick={() => copy(settings.bank_details, ar ? "بيانات الحساب" : "Bank details")}
                  className="ios-row tap hairline-t w-full justify-center font-semibold text-ios-blue"
                >
                  <Copy className="h-4 w-4" /> {ar ? "نسخ بيانات الحساب" : "Copy bank details"}
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="section-label">{ar ? "٢. أرسل الطلب والإيصال" : "2. Send the request & receipt"}</div>
            <a
              href={whatsappUrl(settings.whatsapp_number, msg)}
              target="_blank"
              rel="noreferrer"
              className="tap flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-base font-bold text-white"
            >
              <WhatsAppIcon className="h-5 w-5" />
              {ar ? "إرسال عبر واتساب" : "Send on WhatsApp"}
            </a>
            <p className="mt-2 px-2 text-center text-xs text-muted-foreground">
              {ar ? "تُفتح المحادثة وفيها تفاصيل حجزك جاهزة — أرفق صورة الإيصال ثم أرسل." : "The chat opens with your booking details — attach the receipt and send."}
            </p>
          </div>

          <Link to="/" className="tap flex h-12 w-full items-center justify-center rounded-2xl bg-fill text-[15px] font-bold">
            {t(lang, "back_home")}
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}
