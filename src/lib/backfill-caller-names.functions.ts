import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractCallerName } from "./caller-name";

export const backfillCallerNames = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Any authenticated user can run this maintenance action; it only
    // rewrites caller_name on rows they can already read via RLS.
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data, error } = await supabaseAdmin
      .from("calls")
      .select("id, caller_name, transcript")
      .not("transcript", "is", null);
    if (error) throw new Error(error.message);

    let updated = 0;
    let cleared = 0;
    let kept = 0;
    for (const row of data ?? []) {
      const name = extractCallerName(row.transcript);
      if (name && name !== row.caller_name) {
        await supabaseAdmin
          .from("calls")
          .update({ caller_name: name })
          .eq("id", row.id);
        updated++;
      } else if (!name && row.caller_name) {
        // Clear obviously-wrong values previously written by the naive extractor.
        await supabaseAdmin
          .from("calls")
          .update({ caller_name: null })
          .eq("id", row.id);
        cleared++;
      } else {
        kept++;
      }
    }
    return { total: data?.length ?? 0, updated, cleared, kept };
  });
