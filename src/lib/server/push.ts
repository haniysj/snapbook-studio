// Server-only: web push to supervisors' phones/computers.
import { q, tbl } from "./db";

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let configured = false;
async function lib() {
  const mod: any = await import("web-push");
  const webpush = mod.default ?? mod;
  if (!configured) {
    const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) throw new Error("Push keys are not configured");
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
    configured = true;
  }
  return webpush;
}

/** Send to every saved device (optionally only one supervisor's). Dead subscriptions are removed. */
export async function sendPush(payload: PushPayload, adminId?: string) {
  const subs = await q<Sub>(
    `select id::text as id, endpoint, p256dh, auth from ${tbl("push_subscriptions")}${adminId ? " where admin_id::text = $1" : ""}`,
    adminId ? [adminId] : [],
  );
  if (!subs.length) return { sent: 0, total: 0 };
  const webpush = await lib();
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24, urgency: "high" });
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await q(`delete from ${tbl("push_subscriptions")} where id::text = $1`, [s.id]);
        } else {
          console.error("push", e?.statusCode, e?.body ?? e?.message);
        }
      }
    }),
  );
  return { sent, total: subs.length };
}

/** Called after a visitor submits a booking. Never throws (a booking must not fail because of push). */
export async function notifyNewBooking(bookingId: string) {
  try {
    const rows = await q<{ customer_name: string; event_date: string; event_time: string; pkg: string | null; service_type: string }>(
      `select b.customer_name, b.event_date::text as event_date, to_char(b.event_time, 'HH24:MI') as event_time, p.name_ar as pkg, b.service_type
         from ${tbl("bookings")} b left join ${tbl("packages")} p on p.id = b.package_id
        where b.id::text = $1`,
      [bookingId],
    );
    const b = rows[0];
    if (!b) return;
    await Promise.race([
      sendPush({
        title: "📸 حجز جديد",
        body: `${b.service_type ? `تصوير ${b.service_type} · ` : ""}${b.customer_name} — ${new Date(`${b.event_date}T00:00:00`).toLocaleDateString("ar-OM", { weekday: "long", day: "numeric", month: "long" })} الساعة ${b.event_time}${b.pkg ? ` · ${b.pkg}` : ""}`,
        url: "/admin",
        tag: `booking-${bookingId}`,
      }),
      new Promise((r) => setTimeout(r, 6000)),
    ]);
  } catch (e: any) {
    console.error("notifyNewBooking", e?.message);
  }
}

/**
 * Day-before reminder: alerts every supervisor about tomorrow's shoots (Oman time).
 * Run once a day by the Vercel cron (/api/cron/reminders). Each booking is reminded only once.
 */
export async function sendTomorrowReminders() {
  const rows = await q<{ id: string; customer_name: string; event_time: string; pkg: string | null; service_type: string; phone: string; event_location_url: string; notes: string }>(
    `select b.id::text as id, b.customer_name, to_char(b.event_time, 'HH24:MI') as event_time, p.name_ar as pkg,
            b.service_type, b.phone, b.event_location_url, b.notes
       from ${tbl("bookings")} b left join ${tbl("packages")} p on p.id = b.package_id
      where b.event_date = ((now() at time zone 'Asia/Muscat')::date + 1)
        and b.status <> 'cancelled' and b.reminder_sent_at is null
      order by b.event_time`,
  );
  let sent = 0;
  for (const b of rows) {
    const what = [b.service_type ? `تصوير ${b.service_type}` : "تصوير", b.pkg].filter(Boolean).join(" · ");
    const r = await sendPush({
      title: "⏰ تذكير: تصوير غداً",
      body: `${b.customer_name} — الساعة ${b.event_time}\n${what}${b.notes ? `\n${b.notes}` : ""}`,
      url: "/admin",
      tag: `reminder-${b.id}`,
    });
    sent += r.sent;
    await q(`update ${tbl("bookings")} set reminder_sent_at = now() where id::text = $1`, [b.id]);
  }
  return { bookings: rows.length, sent };
}
