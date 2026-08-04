import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Site = {
  id: string;
  name: string;
  retell_agent_id: string | null;
  phone_number: string | null;
};

async function fetchCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function fetchSitesAndSelection(): Promise<{
  sites: Site[];
  selectedSiteId: string | null;
  userId: string | null;
}> {
  const userId = await fetchCurrentUserId();
  if (!userId) return { sites: [], selectedSiteId: null, userId: null };

  const [{ data: sites }, { data: profile }] = await Promise.all([
    supabase
      .from("sites")
      .select("id, name, retell_agent_id, phone_number")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("selected_site_id").eq("id", userId).maybeSingle(),
  ]);

  let selectedSiteId = profile?.selected_site_id ?? null;
  const list = (sites ?? []) as Site[];
  // Fall back to the first site if the stored selection is stale / null.
  if (!selectedSiteId || !list.some((s) => s.id === selectedSiteId)) {
    selectedSiteId = list[0]?.id ?? null;
  }
  return { sites: list, selectedSiteId, userId };
}

export function useSelectedSite() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["sites-and-selection"],
    queryFn: fetchSitesAndSelection,
    staleTime: 30_000,
  });

  const sites = query.data?.sites ?? [];
  const selectedSiteId = query.data?.selectedSiteId ?? null;
  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? null;

  const selectSite = useCallback(
    async (siteId: string) => {
      const userId = query.data?.userId ?? (await fetchCurrentUserId());
      if (!userId) return;
      // Optimistic
      queryClient.setQueryData(["sites-and-selection"], (prev: typeof query.data) =>
        prev ? { ...prev, selectedSiteId: siteId } : prev,
      );
      const { error } = await supabase
        .from("profiles")
        .update({ selected_site_id: siteId })
        .eq("id", userId);
      if (error) {
        // Revert on failure
        queryClient.invalidateQueries({ queryKey: ["sites-and-selection"] });
        return;
      }
      // Refetch site-scoped data
      queryClient.invalidateQueries({ queryKey: ["calls"] });
    },
    [queryClient, query.data?.userId],
  );

  return {
    sites,
    selectedSite,
    selectedSiteId,
    selectSite,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
