import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// Daily Vercel cron (see vercel.json): pushes a reminder to every supervisor for tomorrow's shoots.
// Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is refused.
export const Route = createFileRoute("/api/cron/reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        try {
          const { sendTomorrowReminders } = await import("@/lib/server/push");
          return Response.json(await sendTomorrowReminders());
        } catch (e: any) {
          console.error("reminders", e?.message);
          return Response.json({ error: e?.message ?? "Failed" }, { status: 500 });
        }
      },
    },
  },
});
