import { useMemo, useState } from "react";
import { Currency } from "@/components/site/Currency";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, MapPin, MessageSquareText, Phone, Search, Trash2, X, Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang, useSettings } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { whatsappUrl } from "@/lib/helpers";
import { SegmentedControl } from "@/components/ui/segmented";
import { WhatsAppIcon } from "@/components/site/BrandLogo";
import { formatPrice } from "@/components/site/PackagesGrid";
import { cn } from "@/lib/utils";

type Status = "pending" | "confirmed" | "cancelled";
type Filter = "all" | Status;

const STATUS_STYLE: Record<Status, string> = {
  pending: "bg-ios-orange/15 text-ios-orange",
  confirmed: "bg-ios-green/15 text-ios-green",
  cancelled: "bg-ios-red/12 text-ios-red",
};

export function BookingsTab() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const { settings } = useSettings();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin_bookings"],
    queryFn: async () =>
      (await supabase.from("bookings").select("*, packages(name_ar, name_en, price, currency)").order("created_at", { ascending: false })).data ?? [],
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin_bookings"] });
    qc.invalidateQueries({ queryKey: ["booked_dates_rpc"] });
  };

  const setStatus = async (b: any, status: Status) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success(status === "confirmed" ? (ar ? "تم تأكيد الحجز" : "Booking confirmed") : status === "cancelled" ? (ar ? "تم إلغاء الحجز" : "Booking cancelled") : (ar ? "تم التحديث" : "Updated"));
    refresh();
  };

  const remove = async (b: any) => {
    if (!confirm(ar ? `حذف حجز ${b.customer_name} نهائياً؟` : `Delete ${b.customer_name}'s booking permanently?`)) return;
    const { error } = await supabase.from("bookings").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const today = new Date().toISOString().slice(0, 10);
  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, confirmed: 0, cancelled: 0 } as Record<Filter, number>;
    rows.forEach((r: any) => { c[r.status as Status]++; });
    return c;
  }, [rows]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((b: any) => filter === "all" || b.status === filter)
      .filter((b: any) => {
        if (!q) return true;
        const ref = `#${b.id.slice(0, 8)}`.toLowerCase();
        return b.customer_name?.toLowerCase().includes(q) || b.phone?.replace(/\s/g, "").includes(q.replace(/\s/g, "")) || ref.includes(q);
      })
      // upcoming first (nearest date on top), past events after
      .sort((a: any, b: any) => {
        const ap = a.event_date < today, bp = b.event_date < today;
        if (ap !== bp) return ap ? 1 : -1;
        return ap ? (a.event_date < b.event_date ? 1 : -1) : a.event_date < b.event_date ? -1 : 1;
      });
  }, [rows, filter, search, today]);

  const confirmMsg = (b: any) => {
    const p = b.packages;
    const pkg = p ? (ar ? p.name_ar : p.name_en || p.name_ar) : "";
    const ref = `#${b.id.slice(0, 8).toUpperCase()}`;
    return ar
      ? `مرحباً ${b.customer_name}،\nتم تأكيد حجزك ${ref} لدى ${settings.site_name} ✅\n\nالتاريخ: ${b.event_date}\nالوقت: ${b.event_time?.slice(0, 5) ?? ""}${b.service_type ? `\nنوع التصوير: ${b.service_type}` : ""}\nالباقة: ${pkg}${b.event_location_url ? `\nالموقع: ${b.event_location_url}` : ""}\n\nشكراً لثقتك بنا.`
      : `Hello ${b.customer_name},\nYour booking ${ref} with ${settings.site_name} is confirmed ✅\n\nDate: ${b.event_date}\nTime: ${b.event_time?.slice(0, 5) ?? ""}\nPackage: ${pkg}${b.event_location_url ? `\nLocation: ${b.event_location_url}` : ""}\n\nThank you for choosing us.`;
  };

  return (
    <div className="space-y-4">
      <SegmentedControl
        value={filter}
        onChange={setFilter}
        size="sm"
        options={([
          ["all", ar ? "الكل" : "All"],
          ["pending", t(lang, "status_pending")],
          ["confirmed", t(lang, "status_confirmed")],
          ["cancelled", t(lang, "status_cancelled")],
        ] as [Filter, string][]).map(([v, l]) => ({
          value: v,
          label: l,
          badge: <span className="text-[11px] font-bold opacity-60">{counts[v]}</span>,
        }))}
      />

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={ar ? "بحث بالاسم أو الهاتف أو الرمز" : "Search name, phone or code"}
          className="h-10 w-full rounded-xl bg-fill ps-9 pe-3 text-[15px] outline-none placeholder:text-muted-foreground"
          type="search"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-[1.25rem] bg-fill" />)}</div>
      ) : list.length === 0 ? (
        <div className="ios-card p-10 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? t(lang, "no_bookings") : ar ? "لا توجد نتائج" : "No results"}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((b: any) => {
            const d = new Date(`${b.event_date}T00:00:00`);
            const past = b.event_date < today;
            const p = b.packages;
            return (
              <article key={b.id} className={cn("ios-card p-4", past && "opacity-70")}>
                <div className="flex items-start gap-3">
                  <div className="grid w-14 shrink-0 place-items-center rounded-2xl bg-fill py-1.5 text-center">
                    <span className="text-[11px] font-bold text-ios-red">{d.toLocaleDateString(ar ? "ar-OM" : "en-GB", { weekday: "short" })}</span>
                    <span className="text-2xl font-extrabold leading-none">{d.getDate()}</span>
                    <span className="text-[11px] font-semibold text-muted-foreground">{d.toLocaleDateString(ar ? "ar-OM" : "en-GB", { month: "short" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-[16px] font-bold">{b.customer_name}</h3>
                      <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold", STATUS_STYLE[b.status as Status])}>
                        {t(lang, `status_${b.status}` as any)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap" dir="ltr"><Clock className="h-3.5 w-3.5" />{b.event_time?.slice(0, 5)}</span>
                      <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1 whitespace-nowrap text-ios-blue" dir="ltr"><Phone className="h-3.5 w-3.5" />{b.phone}</a>
                      <span className="font-mono text-[11px]" dir="ltr">#{b.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    {b.service_type && (
                      <div className="mt-2 me-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary/12 px-2.5 py-0.5 text-[12px] font-bold text-primary">
                        <Camera className="h-3.5 w-3.5" />{ar ? `تصوير ${b.service_type}` : b.service_type}
                      </div>
                    )}
                    {p && (
                      <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-fill px-2.5 py-0.5 text-[12px] font-semibold">
                        <span className="truncate">{ar ? p.name_ar : p.name_en || p.name_ar}</span>
                        <span className="whitespace-nowrap text-muted-foreground" dir="ltr"><span className="inline-flex items-center gap-1"><Currency code={p.currency} />{formatPrice(p.price)}</span></span>
                      </div>
                    )}
                    {b.event_location_url && (
                      <a href={b.event_location_url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 text-[13px] font-semibold text-ios-blue">
                        <MapPin className="h-3.5 w-3.5" /> {ar ? "موقع المناسبة" : "Event location"}
                      </a>
                    )}
                    {b.notes && (
                      <p className="mt-2 flex gap-1.5 rounded-xl bg-fill px-3 py-2 text-[13px]">
                        <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />{b.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {b.status !== "confirmed" && (
                    <button type="button" onClick={() => setStatus(b, "confirmed")} className="tap inline-flex h-9 items-center gap-1.5 rounded-full bg-ios-green px-3.5 text-[13px] font-bold text-white">
                      <Check className="h-4 w-4" /> {t(lang, "confirm")}
                    </button>
                  )}
                  <a
                    href={whatsappUrl(b.phone, b.status === "confirmed" ? confirmMsg(b) : "")}
                    target="_blank"
                    rel="noreferrer"
                    className="tap inline-flex h-9 items-center gap-1.5 rounded-full bg-[#25D366]/15 px-3.5 text-[13px] font-bold text-[#128C4B] dark:text-[#25D366]"
                    title={b.status === "confirmed" ? (ar ? "إرسال رسالة التأكيد للعميل" : "Send confirmation to client") : "WhatsApp"}
                  >
                    <WhatsAppIcon className="h-4 w-4" /> {b.status === "confirmed" ? (ar ? "إرسال التأكيد" : "Send confirmation") : (ar ? "مراسلة" : "Message")}
                  </a>
                  <div className="ms-auto flex gap-2">
                    {b.status !== "cancelled" && (
                      <button type="button" onClick={() => setStatus(b, "cancelled")} aria-label={ar ? "إلغاء الحجز" : "Cancel booking"} title={ar ? "إلغاء الحجز" : "Cancel booking"} className="tap grid h-9 w-9 place-items-center rounded-full bg-fill">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => remove(b)} aria-label={t(lang, "delete")} title={t(lang, "delete")} className="tap grid h-9 w-9 place-items-center rounded-full bg-ios-red/12 text-ios-red">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
