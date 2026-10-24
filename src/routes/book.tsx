import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Currency, OldPrice } from "@/components/site/Currency";
import { z } from "zod";
import { useState, type ReactNode } from "react";
import { ar as arLocale, enUS } from "date-fns/locale";
import { format } from "date-fns";
import { CalendarDays, Check, Clock, Loader2, MapPin, Phone, StickyNote, UserRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteChrome";
import { StudioCalendar, toDate, toKey, useBookedDates } from "@/components/site/BookingCalendar";
import { formatPrice, offerActive, usePackages } from "@/components/site/PackagesGrid";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  date: z.string().optional(),
  package_id: z.string().optional(),
});

export const Route = createFileRoute("/book")({
  validateSearch: (s) => searchSchema.parse(s),
  component: BookPage,
});

export type BookingSummary = {
  id: string; name: string; phone: string; date: string; time: string; pkg: string; location: string; notes: string;
};

function BookPage() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const { date: initialDate, package_id: initialPkg } = Route.useSearch();
  const bookedDates = useBookedDates();
  const { data: packages = [] } = usePackages();

  const [date, setDate] = useState<Date | undefined>(initialDate ? toDate(initialDate) : undefined);
  const [pickingDate, setPickingDate] = useState(!initialDate);
  const [time, setTime] = useState("18:00");
  const [pkg, setPkg] = useState<string>(initialPkg ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const dateIsBooked = !!date && bookedDates.some((d) => toKey(d) === toKey(date));
  const locale = ar ? arLocale : enUS;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || dateIsBooked) { setPickingDate(true); return toast.error(t(lang, "choose_date_first")); }
    if (!pkg) return toast.error(t(lang, "select_package"));
    if (name.trim().length < 2) return toast.error(ar ? "اكتب الاسم" : "Enter your name");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) return toast.error(ar ? "اكتب رقم هاتف صحيح" : "Enter a valid phone number");

    setSubmitting(true);
    const id = crypto.randomUUID();
    const { error } = await supabase.from("bookings").insert({
      id,
      customer_name: name.trim(),
      phone: phone.trim(),
      event_location_url: location.trim(),
      event_date: toKey(date),
      event_time: time,
      package_id: pkg,
      notes: notes.trim(),
      status: "pending",
    });
    setSubmitting(false);
    if (error) return toast.error(ar ? "تعذّر إرسال الطلب، حاول مرة أخرى" : "Couldn't send the request, please try again");

    const chosen = packages.find((p) => p.id === pkg);
    const summary: BookingSummary = {
      id, name: name.trim(), phone: phone.trim(), date: toKey(date), time, location: location.trim(), notes: notes.trim(),
      pkg: chosen ? (ar ? chosen.name_ar : chosen.name_en || chosen.name_ar) : "",
    };
    try { sessionStorage.setItem(`booking:${id}`, JSON.stringify(summary)); } catch { /* ignore */ }
    navigate({ to: "/booking-confirmed/$id", params: { id } });
  };

  return (
    <SiteShell title={t(lang, "book_now")}>
      <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-6 px-4 pb-10 pt-6">
        <div className="px-1">
          <h1 className="large-title">{t(lang, "book_now")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{ar ? "ثلاث خطوات بسيطة ونتواصل معك." : "Three quick steps and we'll be in touch."}</p>
        </div>

        {/* 1. Date & time */}
        <Group label={ar ? "١. الموعد" : "1. Date & time"}>
          {pickingDate || !date ? (
            <div className="px-2 pb-3 pt-3">
              <StudioCalendar
                selected={date}
                onSelect={(d) => { setDate(d); if (d) setPickingDate(false); }}
                bookedDates={bookedDates}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setPickingDate(true)} className="ios-row tap w-full text-start">
              <Icon tint="bg-ios-red"><CalendarDays className="h-[17px] w-[17px]" /></Icon>
              <span className="flex-1 font-semibold">{format(date, "EEEE d MMMM yyyy", { locale })}</span>
              <span className="text-sm font-semibold text-ios-blue">{ar ? "تغيير" : "Change"}</span>
            </button>
          )}
          <label className="ios-row">
            <Icon tint="bg-ios-orange"><Clock className="h-[17px] w-[17px]" /></Icon>
            <span className="flex-1 font-semibold">{t(lang, "form_time")}</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              dir="ltr"
              className="rounded-lg bg-fill px-2.5 py-1 text-[15px] font-semibold outline-none"
            />
          </label>
        </Group>
        {dateIsBooked && <p className="-mt-4 px-4 text-sm font-semibold text-ios-red">{t(lang, "date_taken")}</p>}

        {/* 2. Package */}
        <Group label={ar ? "٢. الباقة" : "2. Package"}>
          {packages.length === 0 && <div className="ios-row text-sm text-muted-foreground">{t(lang, "loading")}</div>}
          {packages.map((p) => {
            const active = pkg === p.id;
            const offer = offerActive(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPkg(p.id)}
                aria-pressed={active}
                className="ios-row tap w-full text-start"
              >
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                  )}
                >
                  {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{ar ? p.name_ar : p.name_en || p.name_ar}</span>
                  {(ar ? p.description_ar : p.description_en || p.description_ar) && (
                    <span className="block truncate text-xs text-muted-foreground">{ar ? p.description_ar : p.description_en || p.description_ar}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2" dir="ltr">
                  {offer && <OldPrice amount={formatPrice(p.price)} code={p.currency} lang={lang} className="text-[12px]" />}
                  <span className="flex items-center gap-1 whitespace-nowrap font-bold"><Currency code={p.currency} className="text-muted-foreground" />{formatPrice(offer ? p.discounted_price : p.price)}</span>
                </span>
              </button>
            );
          })}
        </Group>

        {/* 3. Details */}
        <Group label={ar ? "٣. بياناتك" : "3. Your details"}>
          <Field icon={<UserRound className="h-[17px] w-[17px]" />} tint="bg-ios-blue">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(lang, "form_name")}
              autoComplete="name"
              required
              className="w-full bg-transparent py-1 outline-none placeholder:text-muted-foreground"
            />
          </Field>
          <Field icon={<Phone className="h-[17px] w-[17px]" />} tint="bg-ios-green">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={ar ? "رقم الهاتف (واتساب)" : "Phone (WhatsApp)"}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              required
              className="w-full bg-transparent py-1 text-start outline-none placeholder:text-muted-foreground rtl:text-right"
            />
          </Field>
          <Field icon={<MapPin className="h-[17px] w-[17px]" />} tint="bg-ios-red">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={ar ? "رابط موقع المناسبة (اختياري)" : "Event location link (optional)"}
              inputMode="url"
              dir="ltr"
              className="w-full bg-transparent py-1 outline-none placeholder:text-muted-foreground rtl:text-right"
            />
          </Field>
          <Field icon={<StickyNote className="h-[17px] w-[17px]" />} tint="bg-[#8E8E93]" top>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t(lang, "form_notes")}
              rows={2}
              className="w-full resize-none bg-transparent py-1 outline-none placeholder:text-muted-foreground"
            />
          </Field>
        </Group>

        <button
          type="submit"
          disabled={submitting}
          className="tap flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-60"
        >
          {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
          {t(lang, "submit_booking")}
        </button>
        <p className="-mt-3 px-2 text-center text-xs text-muted-foreground">
          {ar ? "الحجز مبدئي ويُثبَّت بعد تحويل الدفعة المقدمة وتأكيد الاستوديو." : "Your date is held until the advance payment is received and confirmed."}
        </p>
      </form>
    </SiteShell>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="section-label">{label}</div>
      <div className="ios-group ios-divide">{children}</div>
    </div>
  );
}

function Icon({ tint, children }: { tint: string; children: ReactNode }) {
  return <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-white ${tint}`}>{children}</span>;
}

function Field({ icon, tint, children, top }: { icon: ReactNode; tint: string; children: ReactNode; top?: boolean }) {
  return (
    <label className={cn("ios-row", top && "items-start")}>
      <Icon tint={tint}>{icon}</Icon>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
