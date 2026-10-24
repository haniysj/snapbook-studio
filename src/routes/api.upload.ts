import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// Issues short-lived presigned upload URLs to signed-in admins only.
// The browser then PUTs the file straight to Vercel Blob (no 4.5 MB function limit, so videos work).
// Works with the OIDC-based Blob store (BLOB_STORE_ID) and with a classic BLOB_READ_WRITE_TOKEN.
export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleUploadPresigned } = await import("@vercel/blob/client");
        const { issueSignedToken } = await import("@vercel/blob");
        const { currentAdmin } = await import("@/lib/server/session");
        try {
          const body = await request.json();
          const json = await handleUploadPresigned({
            body,
            request,
            getSignedToken: async (pathname) => {
              const admin = await currentAdmin();
              if (!admin) throw new Error("Unauthorized");
              if (!/^(gallery|logo)\//.test(pathname)) throw new Error("Invalid path");
              const constraints = {
                allowedContentTypes: ["image/*", "video/*"],
                maximumSizeInBytes: 500 * 1024 * 1024,
              };
              const token = await issueSignedToken({
                pathname,
                operations: ["put"],
                validUntil: Date.now() + 10 * 60 * 1000,
                ...constraints,
              });
              return { token, urlOptions: { ...constraints, addRandomSuffix: true } };
            },
          });
          return Response.json(json);
        } catch (e: any) {
          console.error("upload", e?.message);
          return Response.json({ error: e?.message ?? "Upload failed" }, { status: 400 });
        }
      },
    },
  },
});
