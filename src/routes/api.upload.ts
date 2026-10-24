import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// Issues short-lived Vercel Blob upload tokens to signed-in admins only.
// The browser then uploads the file straight to Blob storage (no 4.5 MB function limit, so videos work).
export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleUpload } = await import("@vercel/blob/client");
        const { currentAdmin } = await import("@/lib/server/session");
        try {
          const body = await request.json();
          const json = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname) => {
              const admin = await currentAdmin();
              if (!admin) throw new Error("Unauthorized");
              if (!/^(gallery|logo)\//.test(pathname)) throw new Error("Invalid path");
              return {
                allowedContentTypes: ["image/*", "video/*"],
                maximumSizeInBytes: 500 * 1024 * 1024,
                addRandomSuffix: true,
              };
            },
            onUploadCompleted: async () => {},
          });
          return Response.json(json);
        } catch (e: any) {
          return Response.json({ error: e?.message ?? "Upload failed" }, { status: 400 });
        }
      },
    },
  },
});
