import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, Plus, Trash2, Save, Loader2 } from "lucide-react";

import { GatedPage } from "@/components/GatedPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedSite, type Site } from "@/hooks/useSelectedSite";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Atyvia" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <GatedPage>
      <div className="mx-auto max-w-[900px] space-y-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary glow">
            <SettingsIcon className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your workspace and sites.</p>
          </div>
        </div>
        <SitesSection />
      </div>
    </GatedPage>
  );
}

function SitesSection() {
  const { sites, selectedSite, isLoading, refetch } = useSelectedSite();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const createSite = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("sites").insert({ user_id: userId, name });
      if (error) throw error;
      setNewName("");
      await refetch();
      toast.success("Site added");
    } catch (err) {
      toast.error("Could not add site", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Sites</h2>
        <p className="text-sm text-muted-foreground">
          Each site has its own calls and dashboard data. Switch between them from the top bar.
        </p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((site) => (
            <SiteRow key={site.id} site={site} isSelected={site.id === selectedSite?.id} onChange={refetch} />
          ))}
          {sites.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              You don't have any sites yet.
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-border pt-4">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="new-site">Add a new site</Label>
          <Input
            id="new-site"
            placeholder="e.g. Meridian Dental Group"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createSite();
              }
            }}
          />
        </div>
        <Button
          onClick={() => void createSite()}
          disabled={creating || !newName.trim()}
          className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add site
        </Button>
      </div>
    </div>
  );
}

function SiteRow({
  site,
  isSelected,
  onChange,
}: {
  site: Site;
  isSelected: boolean;
  onChange: () => void;
}) {
  const [form, setForm] = useState({
    name: site.name,
    retell_agent_id: site.retell_agent_id ?? "",
    phone_number: site.phone_number ?? "",
  });
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("sites")
        .update({
          name: form.name.trim(),
          retell_agent_id: form.retell_agent_id.trim() || null,
          phone_number: form.phone_number.trim() || null,
        })
        .eq("id", site.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Site updated");
      onChange();
    },
    onError: (err) => {
      toast.error("Could not update site", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sites").delete().eq("id", site.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Site deleted", { description: "Its calls have been kept and unassigned." });
      onChange();
      queryClient.invalidateQueries({ queryKey: ["calls"] });
    },
    onError: (err) => {
      toast.error("Could not delete site", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

  const dirty =
    form.name !== site.name ||
    (form.retell_agent_id || null) !== (site.retell_agent_id ?? null) ||
    (form.phone_number || null) !== (site.phone_number ?? null);

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-primary text-xs font-bold text-primary-foreground">
            {(form.name.trim()[0] ?? "?").toUpperCase()}
          </div>
          <div className="text-sm font-medium">{site.name}</div>
          {isSelected && (
            <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-semibold text-secondary">
              Current
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-destructive hover:text-destructive"
          onClick={() => {
            if (confirm(`Delete "${site.name}"? Its calls will be kept but unassigned.`)) {
              void del.mutate();
            }
          }}
          disabled={del.isPending}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor={`name-${site.id}`}>Name</Label>
          <Input
            id={`name-${site.id}`}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor={`agent-${site.id}`}>Retell agent ID</Label>
          <Input
            id={`agent-${site.id}`}
            placeholder="agent_..."
            value={form.retell_agent_id}
            onChange={(e) => setForm((f) => ({ ...f, retell_agent_id: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor={`phone-${site.id}`}>Phone number</Label>
          <Input
            id={`phone-${site.id}`}
            placeholder="+44 20 ..."
            value={form.phone_number}
            onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={!dirty || save.isPending || !form.name.trim()}
          onClick={() => save.mutate()}
          className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-1.5"
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
      </div>
    </div>
  );
}

