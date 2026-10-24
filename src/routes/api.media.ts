import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// The Blob store is private, so its file URLs can't be shown in <img>/<video> directly.
// This route redirects to a short-lived signed GET URL for files in OUR store only.
// The browser then loads the file straight from Blob (range requests work, so videos seek).

let cachedToken: { token: any; validUntil: number } | null = null;
const DAY = 24 * 60 * 60 * 1000;

async function readToken() {
  if (cachedToken && cachedToken.validUntil - Date.now() > 3 * 60 * 60 * 1000) return cachedToken;
  const { issueSignedToken } = await import("@vercel/blob");
  const validUntil = Date.now() + DAY;
  const token = await issueSignedToken({ pathname: "*", operations: ["get"], validUntil });
  cachedToken = { token, validUntil };
  return cachedToken;
}

function storeHostPrefix() {
  const id = (process.env.BLOB_STORE_ID ?? "").replace(/^store_/, "").toLowerCase();
  return id;
}

export const Route = createFileRoute("/api/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const u = new URL(request.url).searchParams.get("u") ?? "";
          const target = new URL(u);
          const prefix = storeHostPrefix();
          const m = target.hostname.match(/^([a-z0-9]+)\.(public|private)\.blob\.vercel-storage\.com$/);
          if (target.protocol !== "https:" || !m || (prefix && m[1] !== prefix)) {
            return new Response("Not found", { status: 404 });
          }
          if (m[2] === "public") {
            return Response.redirect(target.toString(), 302);
          }
          const pathname = decodeURIComponent(target.pathname.replace(/^\//, ""));
          const { presignUrl } = await import("@vercel/blob");
          const { token, validUntil } = await readToken();
          const { presignedUrl } = await presignUrl(token, {
            access: "private",
            operation: "get",
            pathname,
            validUntil: validUntil - 60 * 60 * 1000,
          });
          return new Response(null, {
            status: 302,
            headers: {
              Location: presignedUrl,
              // Files never change (random suffix), so the redirect can be cached for an hour.
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
          });
        } catch (e: any) {
          console.error("media", e?.message);
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
