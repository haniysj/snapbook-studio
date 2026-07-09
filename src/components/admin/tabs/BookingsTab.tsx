import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/app-context";
import { t } from "@/lib/i18n";
import { useSettings } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink, MessageCircle, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { whatsappUrl } from "@/lib/helpers";
import { format } from "date-fns";

export function BookingsTab() {
  const { lang } = useLang();
  const { settings } = useSettings();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin_bookings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*, packages(name_ar, name_en, price, currency)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const setStatus = async (id: string, status: "pending" | "confirmed" | "cancelled", booking?: any) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(lang === "ar" ? "تم التحديث" : "Updated");
    qc.invalidateQueries({ queryKey: ["admin_bookings"] });
    qc.invalidateQueries({ queryKey: ["booked_dates"] });

    if (status === "confirmed" && booking?.phone) {
      const pkg = booking.packages;
      const pkgName = pkg ? (lang === "ar" ? pkg.name_ar : (pkg.name_en || pkg.name_ar)) : "";
      const ref = `#${id.slice(0, 8).toUpperCase()}`;
      const msg = lang === "ar"
        ? `مرحباً ${booking.customer_name}،\nتم تأكيد حجزك ${ref} لدى ${settings.site_name}. 🎉\n\nالتاريخ: ${booking.event_date}\nالوقت: ${booking.event_time?.slice(0,5) ?? ""}\nالباقة: ${pkgName}${pkg ? ` (${pkg.price} ${pkg.currency})` : ""}${booking.event_location_url ? `\nالموقع: ${booking.event_location_url}` : ""}${booking.notes ? `\nملاحظات: ${booking.notes}` : ""}\n\nنشكرك على ثقتك بنا.`
        : `Hello ${booking.customer_name},\nYour booking ${ref} with ${settings.site_name} is confirmed. 🎉\n\nDate: ${booking.event_date}\nTime: ${booking.event_time?.slice(0,5) ?? ""}\nPackage: ${pkgName}${pkg ? ` (${pkg.price} ${pkg.currency})` : ""}${booking.event_location_url ? `\nLocation: ${booking.event_location_url}` : ""}${booking.notes ? `\nNotes: ${booking.notes}` : ""}\n\nThank you for choosing us.`;
      try {
        window.open(whatsappUrl(booking.phone, msg), "_blank", "noopener,noreferrer");
      } catch { /* ignore */ }
    }
  };

  const remove = async (id: string) => {
    if (!confirm(lang === "ar" ? "حذف الحجز؟" : "Delete booking?")) return;
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin_bookings"] });
    qc.invalidateQueries({ queryKey: ["booked_dates"] });
  };

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((b: any) => {
      const ref = `#${b.id.slice(0, 8).toUpperCase()}`.toLowerCase();
      return (
        b.customer_name?.toLowerCase().includes(q) ||
        b.phone?.toLowerCase().includes(q) ||
        ref.includes(q) ||
        b.id?.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  if (isLoading) return <div className="text-sm text-muted-foreground">{t(lang, "loading")}</div>;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-3" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={lang === "ar" ? "ابحث بالاسم أو الرمز أو رقم الهاتف" : "Search by name, code, or phone"}
          className="ps-9"
        />
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? t(lang, "no_bookings") : (lang === "ar" ? "لا توجد نتائج" : "No results")}
        </div>
      ) : filtered.map((b: any) => {
        const pkg = b.packages;
        const waMsg = `${t(lang, "wa_confirm_msg")}\n\n${t(lang, "form_name")}: ${b.customer_name}\n${t(lang, "form_date")}: ${b.event_date} ${b.event_time}\n${t(lang, "form_package")}: ${pkg?.name_ar ?? ""}\n${b.event_location_url ? `📍 ${b.event_location_url}` : ""}`;
        return (
          <div key={b.id} className="card-elegant flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{b.customer_name}</span>
                <StatusBadge status={b.status} />
                <span className="text-xs text-muted-foreground" dir="ltr">{b.phone}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                📅 {format(new Date(b.event_date), "yyyy-MM-dd")} — 🕐 {b.event_time?.slice(0, 5)} — 📦 {pkg?.name_ar ?? "—"} ({pkg?.price} {pkg?.currency})
              </div>
              {b.event_location_url && (
                <a href={b.event_location_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gold hover:underline">
                  <ExternalLink className="h-3 w-3" /> {lang === "ar" ? "الموقع" : "Location"}
                </a>
              )}
              {b.notes && <p className="text-xs text-muted-foreground">{b.notes}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {b.status !== "confirmed" && (
                <Button size="sm" onClick={() => setStatus(b.id, "confirmed", b)} className="gap-1 bg-gradient-to-r from-gold to-gold-soft text-primary-foreground">
                  <Check className="h-3.5 w-3.5" /> {t(lang, "confirm")}
                </Button>
              )}
              <a href={whatsappUrl(b.phone || settings.whatsapp_number, waMsg)} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="gap-1"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button>
              </a>
              {b.status !== "cancelled" && (
                <Button size="sm" variant="outline" onClick={() => setStatus(b.id, "cancelled", b)} className="gap-1">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => remove(b.id)} className="gap-1 text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { lang } = useLang();
  const map: Record<string, string> = { pending: "status_pending", confirmed: "status_confirmed", cancelled: "status_cancelled" };
  const color = status === "confirmed" ? "bg-green-500/20 text-green-700 dark:text-green-300" : status === "cancelled" ? "bg-destructive/20 text-destructive" : "bg-muted";
  return <Badge className={color} variant="secondary">{t(lang, map[status] as any)}</Badge>;
}
