import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { ar as arLocale, enUS } from "date-fns/locale";
import { format } from "date-fns";
import { CalendarCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeading } from "@/components/site/SectionHeading";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";

export function toDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function toKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function useBookedDates() {
  const { data: rows = [] } = useQuery({
    queryKey: ["booked_dates_rpc"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_booked_dates");
      return (data ?? []) as Array<{ event_date: string | null }>;
    },
  });
  return useMemo(() => rows.filter((b): b is { event_date: string } => !!b.event_date).map((b) => toDate(b.event_date)), [rows]);
}

/** Shared iOS-styled month picker used on the home page and the booking page. */
export function StudioCalendar({
  selected,
  onSelect,
  bookedDates,
}: {
  selected: Date | undefined;
  onSelect: (d: Date | undefined) => void;
  bookedDates: Date[];
}) {
  const { lang } = useLang();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <div className="flex flex-col items-center">
      <DayPicker
        mode="single"
        weekStartsOn={0}
        selected={selected}
        onSelect={onSelect}
        startMonth={today}
        disabled={[{ before: today }, ...bookedDates]}
        modifiers={{ booked: bookedDates, weekend: { dayOfWeek: [5, 6] } }}
        modifiersClassNames={{ booked: "rdp-day-booked", weekend: "rdp-day-weekend" }}
        locale={lang === "ar" ? arLocale : enUS}
        dir={lang === "ar" ? "rtl" : "ltr"}
      />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <Legend dot="bg-primary" label={t(lang, "legend_selected")} />
        <Legend dot="bg-ios-red" label={t(lang, "legend_booked")} />
        <Legend dot="bg-ios-blue" label={t(lang, "legend_weekend")} />
      </div>
    </div>
  );
}

export function BookingCalendar() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Date | undefined>();
  const bookedDates = useBookedDates();

  return (
    <section id="calendar" className="mx-auto max-w-6xl px-4 py-8 md:py-12">
      <SectionHeading title={t(lang, "calendar_title")} subtitle={t(lang, "calendar_hint")} />
      <div className="ios-card mx-auto max-w-md p-3 pt-4 sm:p-5">
        <StudioCalendar selected={selected} onSelect={setSelected} bookedDates={bookedDates} />
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && navigate({ to: "/book", search: { date: toKey(selected) } })}
          className="tap mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground disabled:bg-fill disabled:text-muted-foreground"
        >
          <CalendarCheck className="h-[18px] w-[18px]" />
          {selected
            ? `${lang === "ar" ? "احجز" : "Book"} ${format(selected, "EEEE d MMMM", { locale: lang === "ar" ? arLocale : enUS })}`
            : t(lang, "choose_date_first")}
        </button>
      </div>
    </section>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
