import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ar as arLocale, enUS } from "date-fns/locale";
import { format } from "date-fns";

function toDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function BookingCalendar() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Date | undefined>();

  const { data: bookedRows = [] } = useQuery({
    queryKey: ["booked_dates_rpc"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_booked_dates");
      return (data ?? []) as Array<{ event_date: string | null }>;
    },
  });

  const bookedDates = useMemo(
    () =>
      bookedRows
        .filter((b): b is { event_date: string } => !!b.event_date)
        .map((b) => toDate(b.event_date)),
    [bookedRows],
  );
  const bookedSet = useMemo(() => new Set(bookedDates.map(toKey)), [bookedDates]);

  const handleBook = () => {
    if (!selected) return toast.error(t(lang, "choose_date_first"));
    if (bookedSet.has(toKey(selected))) return toast.error(t(lang, "date_taken"));
    navigate({ to: "/book", search: { date: toKey(selected) } });
  };

  const localeObj = lang === "ar" ? { ...arLocale, options: { ...arLocale.options, weekStartsOn: 0 as const } } : enUS;

  return (
    <section id="calendar" className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-6 text-center">
        <h2 className="text-2xl md:text-3xl font-bold gold-text">{t(lang, "calendar_title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t(lang, "calendar_hint")}</p>
      </div>

      <div className="mx-auto flex max-w-lg flex-col items-center card-elegant p-4 md:p-6">
        <DayPicker
          mode="single"
          weekStartsOn={0}
          selected={selected}
          onSelect={setSelected}
          disabled={[{ before: new Date() }, ...bookedDates]}
          modifiers={{
            booked: bookedDates,
            weekend: { dayOfWeek: [5, 6] },
          }}
          modifiersClassNames={{
            booked: "rdp-day-booked",
            selected: "rdp-day-selected-gold",
            weekend: "rdp-day-weekend",
          }}
          locale={localeObj}
          dir={lang === "ar" ? "rtl" : "ltr"}
          className="mx-auto"
        />

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs">
          <Legend color="bg-booked" label={t(lang, "legend_booked")} />
          <Legend color="bg-gradient-to-r from-gold to-gold-soft" label={t(lang, "legend_selected")} />
          <Legend color="bg-gold/20 border border-gold/40" label={t(lang, "legend_weekend")} />
          <Legend color="bg-muted border border-border" label={t(lang, "legend_available")} />
        </div>

        <Button
          onClick={handleBook}
          disabled={!selected}
          className="mt-6 w-full bg-gradient-to-r from-gold to-gold-soft text-primary-foreground hover:opacity-90"
        >
          {t(lang, "book_this_date")}
        </Button>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${color}`} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
