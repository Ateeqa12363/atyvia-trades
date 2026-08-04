import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type JobPhoto = {
  id: string;
  job_id: string | null;
  quote_id: string | null;
  site_visit_id: string | null;
  storage_path: string;
  caption: string | null;
  kind: string;
  position: number;
  /** Short-lived signed URL for the private documents bucket. */
  url: string | null;
};

/** Photos for a job / quote / visit, with signed URLs ready for <img src>. */
export const listJobPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { jobId?: string | null; quoteId?: string | null; siteVisitId?: string | null }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let query = supabase
      .from("job_photos")
      .select("id, job_id, quote_id, site_visit_id, storage_path, caption, kind, position")
      .order("position", { ascending: true });
    if (data.jobId) query = query.eq("job_id", data.jobId);
    else if (data.quoteId) query = query.eq("quote_id", data.quoteId);
    else if (data.siteVisitId) query = query.eq("site_visit_id", data.siteVisitId);
    else return { photos: [] as JobPhoto[] };

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const photos: JobPhoto[] = [];
    for (const row of rows ?? []) {
      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrl(row.storage_path as string, 3600);
      photos.push({ ...(row as Omit<JobPhoto, "url">), url: signed?.signedUrl ?? null });
    }
    return { photos };
  });

/** Records a photo already uploaded to `documents/<userId>/...`. */
export const addJobPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      siteId: string;
      storagePath: string;
      jobId?: string | null;
      quoteId?: string | null;
      siteVisitId?: string | null;
      caption?: string | null;
      kind?: "before" | "progress" | "after";
      position?: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("job_photos")
      .insert({
        site_id: data.siteId,
        storage_path: data.storagePath,
        job_id: data.jobId ?? null,
        quote_id: data.quoteId ?? null,
        site_visit_id: data.siteVisitId ?? null,
        caption: data.caption ?? null,
        kind: data.kind ?? "progress",
        position: data.position ?? 0,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { id: row?.id ?? null };
  });

export const deleteJobPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("job_photos")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.storage_path) {
      await supabase.storage.from("documents").remove([row.storage_path as string]);
    }
    const { error } = await supabase.from("job_photos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
