import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ar as arLocale, enUS } from "date-fns/locale";
import { format } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/site/Header";
import { useLang, useSettings } from "@/lib/app-context";
import { whatsappUrl } from "@/lib/helpers";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";

const searchSchema = z.object({
  date: z.string().optional(),
  package_id: z.string().optional(),
});

export const Route = createFileRoute("/book")({
  validateSearch: (s) => searchSchema.parse(s),
  component: BookPage,
});

function toDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function BookPage() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const { date: initialDate, package_id: initialPkg } = Route.useSearch();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate ? toDate(initialDate) : undefined);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [time, setTime] = useState("18:00");
  const [pkg, setPkg] = useState<string>(initialPkg ?? "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: packages = [] } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => (await supabase.from("packages").select("*").eq("active", true).order("sort_order")).data ?? [],
  });

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


  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return toast.error(t(lang, "choose_date_first"));
    if (!name || name.length < 2) return toast.error(lang === "ar" ? "الرجاء إدخال الاسم" : "Please enter your name");
    if (!phone || phone.length < 5) return toast.error(lang === "ar" ? "الرجاء إدخال رقم صحيح" : "Please enter a valid phone");
    if (!pkg) return toast.error(t(lang, "select_package"));

    setSubmitting(true);
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        customer_name: name.trim(),
        phone: phone.trim(),
        event_location_url: location.trim(),
        event_date: toKey(selectedDate),
        event_time: time,
        package_id: pkg,
        notes: notes.trim(),
        status: "pending",
      })
      .select("id")
      .single();
    setSubmitting(false);

    if (error || !data) {
      toast.error(error?.message ?? "Error");
      return;
    }
    navigate({ to: "/booking-confirmed/$id", params: { id: data.id } });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-1 font-display text-3xl font-bold gold-text">{t(lang, "book_now")}</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          {lang === "ar" ? "أكمل بيانات المناسبة لإتمام الحجز." : "Complete your event details to book."}
        </p>

        <form onSubmit={onSubmit} className="card-elegant space-y-5 p-6">
          {/* date section */}
          <div>
            <Label className="mb-2 flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {t(lang, "form_date")}</Label>
            {selectedDate ? (
              <div className="flex items-center justify-between rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm">
                <span>{format(selectedDate, "PPP", { locale: lang === "ar" ? arLocale : enUS })}</span>
                <button type="button" onClick={() => setSelectedDate(undefined)} className="text-xs text-muted-foreground underline">
                  {lang === "ar" ? "تغيير" : "Change"}
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-border p-3">
                <DayPicker
                  mode="single"
                  weekStartsOn={0}
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={[{ before: new Date() }, ...bookedDates]}
                  modifiers={{ booked: bookedDates, weekend: { dayOfWeek: [5, 6] } }}
                  modifiersClassNames={{ booked: "rdp-day-booked", selected: "rdp-day-selected-gold", weekend: "rdp-day-weekend" }}
                  locale={lang === "ar" ? arLocale : enUS}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                />
              </div>

            )}
          </div>

          <Field label={t(lang, "form_name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label={t(lang, "form_phone")}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} required dir="ltr" placeholder="+968..." />
          </Field>
          <Field label={t(lang, "form_location")}>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} dir="ltr" placeholder="https://maps.google.com/..." />
          </Field>
          <Field label={t(lang, "form_time")}>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required dir="ltr" />
          </Field>
          <Field label={t(lang, "form_package")}>
            <Select value={pkg} onValueChange={setPkg}>
              <SelectTrigger><SelectValue placeholder={t(lang, "select_package")} /></SelectTrigger>
              <SelectContent>
                {packages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {(lang === "ar" ? p.name_ar : p.name_en || p.name_ar)} — {Number(p.price).toLocaleString()} {p.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t(lang, "form_notes")}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>

          <div className="flex justify-between gap-3">
            <Link to="/"><Button type="button" variant="outline">{t(lang, "cancel")}</Button></Link>
            <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-gold to-gold-soft text-primary-foreground">
              {submitting ? "..." : t(lang, "submit_booking")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
