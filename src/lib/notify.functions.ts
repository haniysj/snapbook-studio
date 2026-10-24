import { createServerFn } from "@tanstack/react-start";

// Booking notifications for supervisors: bell summary + phone/browser push subscriptions.

export type NotifItem = {
  id: string; customer_name: string; event_date: string; event_time: string;
  status: string; created_at: string; pkg: string | null; is_new: boolean;
};

export const notifSummary = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./server/session");
  const { q, tbl } = await import("./server/db");
  const me = await requireAdmin();
  const items = await q<NotifItem>(
    `select b.id::text as id, b.customer_name, b.event_date::text as event_date, to_char(b.event_time,'HH24:MI') as event_time,
            b.status::text as status, to_char(b.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
            p.name_ar as pkg, (b.created_at > u.last_seen_bookings_at) as is_new
       from ${tbl("bookings")} b
       left join ${tbl("packages")} p on p.id = b.package_id
       cross join (select last_seen_bookings_at from ${tbl("admin_users")} where id::text = $1) u
      order by b.created_at desc
      limit 20`,
    [me.id],
  );
  const unread = await q<{ n: number }>(
    `select count(*)::int as n from ${tbl("bookings")} b, ${tbl("admin_users")} u
      where u.id::text = $1 and b.created_at > u.last_seen_bookings_at`,
    [me.id],
  );
  return { unread: unread[0]?.n ?? 0, items };
});

export const notifMarkSeen = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin } = await import("./server/session");
  const { q, tbl } = await import("./server/db");
  const me = await requireAdmin();
  await q(`update ${tbl("admin_users")} set last_seen_bookings_at = now() where id::text = $1`, [me.id]);
  return { ok: true };
});

export const pushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.VAPID_PUBLIC_KEY ?? "" };
});

export const pushSubscribe = createServerFn({ method: "POST" })
  .inputValidator((d: { endpoint: string; p256dh: string; auth: string; ua?: string }) => d)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    const me = await requireAdmin();
    if (!/^https:\/\//.test(data.endpoint) || !data.p256dh || !data.auth) throw new Error("Invalid subscription");
    await q(
      `insert into ${tbl("push_subscriptions")} (admin_id, endpoint, p256dh, auth, user_agent)
       values ($1, $2, $3, $4, $5)
       on conflict (endpoint) do update set admin_id = excluded.admin_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent`,
      [me.id, data.endpoint, data.p256dh, data.auth, (data.ua ?? "").slice(0, 300)],
    );
    return { ok: true };
  });

export const pushUnsubscribe = createServerFn({ method: "POST" })
  .inputValidator((d: { endpoint: string }) => d)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./server/session");
    const { q, tbl } = await import("./server/db");
    const me = await requireAdmin();
    await q(`delete from ${tbl("push_subscriptions")} where endpoint = $1 and admin_id::text = $2`, [data.endpoint, me.id]);
    return { ok: true };
  });

export const pushTest = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdmin } = await import("./server/session");
  const { sendPush } = await import("./server/push");
  const me = await requireAdmin();
  return sendPush({ title: "🔔 تنبيه تجريبي", body: `مرحباً ${me.display_name}، التنبيهات تعمل على هذا الجهاز.`, url: "/admin", tag: "test" }, me.id);
});
