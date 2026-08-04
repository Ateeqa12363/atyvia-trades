import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/success")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const invoiceId = url.searchParams.get("invoice_id") ?? "";

        let message = "Thank you! Your payment has been received successfully.";
        const heading = "Payment complete";
        const tone: "success" | "error" = "success";

        if (invoiceId) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: invoice } = await supabaseAdmin
              .from("invoices")
              .select("invoice_number, total")
              .eq("id", invoiceId)
              .maybeSingle();

            if (invoice) {
              const formattedTotal = `£${Number(invoice.total ?? 0).toLocaleString("en-GB", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`;
              message = `Thank you! Your payment of ${formattedTotal} for invoice ${invoice.invoice_number} has been received successfully.`;
            }
          } catch (e) {
            console.error("[success-page] failed to fetch invoice details", e);
          }
        }

        return htmlResponse(200, heading, message, tone);
      },
    },
  },
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function htmlResponse(
  status: number,
  heading: string,
  body: string,
  tone: "success" | "error" | "info",
) {
  const accent = tone === "success" ? "#10b981" : tone === "error" ? "#ef4444" : "#0ea5e9";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(heading)} — Atyvia</title>
    <style>
      body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:#f8fafc; color:#0f172a; }
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
      .card { max-width:520px; width:100%; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; padding:36px 32px; box-shadow:0 10px 30px rgba(15,23,42,.06); text-align:center; }
      .dot { width:56px; height:56px; border-radius:999px; background:${accent}22; color:${accent}; display:inline-flex; align-items:center; justify-content:center; font-size:28px; margin-bottom:16px; font-weight:700; }
      h1 { font-size:22px; margin:0 0 8px; }
      p { font-size:15px; line-height:22px; color:#475569; margin:0; }
      .brand { margin-top:24px; font-size:12px; color:#94a3b8; letter-spacing:.08em; text-transform:uppercase; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="dot">${tone === "success" ? "✓" : tone === "error" ? "!" : "i"}</div>
        <h1>${escapeHtml(heading)}</h1>
        <p>${body}</p>
        <div class="brand">Atyvia</div>
      </div>
    </div>
  </body>
</html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
