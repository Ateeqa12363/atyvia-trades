import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { UserCircle2, Save, Loader2 } from "lucide-react";
import { GatedPage } from "@/components/GatedPage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Atyvia" }] }),
  component: ProfilePage,
});

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  company: string;
};

const empty: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "",
  company: "",
};

function ProfilePage() {
  const [form, setForm] = useState<FormState>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (cancelled || !u) {
        setLoading(false);
        return;
      }
      const md = (u.user_metadata ?? {}) as Record<string, unknown>;
      const fullName = (md.full_name as string | undefined) ?? "";
      const [firstFromFull, ...restFull] = fullName.split(" ");
      // Try to load profile row too (may have canonical full_name)
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", u.id)
        .maybeSingle();
      const canonicalFull = profile?.full_name ?? fullName;
      const [firstName, ...rest] = (canonicalFull ?? "").split(" ");
      setForm({
        firstName: (md.first_name as string | undefined) ?? firstName ?? firstFromFull ?? "",
        lastName:
          (md.last_name as string | undefined) ??
          (rest.length ? rest.join(" ") : restFull.join(" ")) ??
          "",
        email: profile?.email ?? u.email ?? "",
        phone: (md.phone as string | undefined) ?? u.phone ?? "",
        role: (md.role as string | undefined) ?? "",
        company: (md.company as string | undefined) ?? "",
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Not signed in");

      const fullName = `${form.firstName} ${form.lastName}`.trim();

      // Persist to auth (metadata + email if changed)
      const authUpdate: {
        email?: string;
        data: Record<string, string>;
      } = {
        data: {
          full_name: fullName,
          first_name: form.firstName,
          last_name: form.lastName,
          phone: form.phone,
          role: form.role,
          company: form.company,
        },
      };
      if (form.email && form.email !== user.email) authUpdate.email = form.email;
      const { error: authErr } = await supabase.auth.updateUser(authUpdate);
      if (authErr) throw authErr;

      // Persist to profiles row (id, email, full_name)
      const { error: profErr } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          email: form.email || user.email || null,
          full_name: fullName || null,
        },
        { onConflict: "id" },
      );
      if (profErr) throw profErr;

      toast.success("Profile updated", {
        description:
          authUpdate.email
            ? "Check your inbox to confirm the new email address."
            : "Your changes have been saved.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Could not save profile", { description: message });
    } finally {
      setSaving(false);
    }
  };

  const initials =
    (form.firstName?.[0] ?? "").toUpperCase() + (form.lastName?.[0] ?? "").toUpperCase() ||
    (form.email?.[0]?.toUpperCase() ?? "?");

  return (
    <GatedPage>
      <div className="mx-auto max-w-[900px]">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary glow">
            <UserCircle2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
            <p className="text-sm text-muted-foreground">Update your personal details and contact info.</p>
          </div>
        </div>

        {loading ? (
          <div className="glass-card rounded-2xl p-10 grid place-items-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <form onSubmit={onSave} className="glass-card rounded-2xl p-6 space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-gradient-primary text-lg font-semibold text-primary-foreground">
                  {initials || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">
                  {`${form.firstName} ${form.lastName}`.trim() || form.email || "Your account"}
                </div>
                <div className="text-sm text-muted-foreground">{form.role || "—"}</div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={form.firstName} onChange={update("firstName")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={form.lastName} onChange={update("lastName")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={update("email")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={update("phone")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <Input id="role" value={form.role} onChange={update("role")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Company</Label>
                <Input id="company" value={form.company} onChange={update("company")} />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" disabled={saving}>Cancel</Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </GatedPage>
  );
}
