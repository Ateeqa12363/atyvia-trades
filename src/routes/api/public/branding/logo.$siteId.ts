import { createFileRoute } from "@tanstack/react-router";

/**
 * Serves a business's logo publicly so it can be embedded in invoice PDFs and
 * emails. The file itself lives in a private bucket, so we stream it here.
 */
export const Route = createFileRoute("/api/public/branding/logo/$siteId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const siteId = params.siteId;
        if (!/^[0-9a-f-]{36}$/i.test(siteId)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("quote_settings")
          .select("logo_url")
          .eq("site_id", siteId)
          .maybeSingle();

        // logo_url stores the storage object path, e.g. "<siteId>/logo.png"
        const path = (settings?.logo_url || "").replace(/^branding\//, "");
        if (!path || !path.startsWith(`${siteId}/`)) {
          return new Response("Not found", { status: 404 });
        }

        const { data: file, error } = await supabaseAdmin.storage.from("branding").download(path);
        if (error || !file) return new Response("Not found", { status: 404 });

        return new Response(await file.arrayBuffer(), {
          headers: {
            "Content-Type": file.type || "image/png",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
