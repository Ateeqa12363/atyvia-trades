import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import atyviaLogoUrl from "@/assets/atyvia-logo.svg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Atyvia" },
      { name: "description", content: "Sign in to your Atyvia dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Sign-in state
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");




  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) navigate({ to: (redirect ?? "/") as string, replace: true });
    })();
  }, [navigate, redirect]);

  const afterAuth = () => navigate({ to: (redirect ?? "/") as string, replace: true });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPassword });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in");
    afterAuth();
  };




  const handleGoogle = async () => {
    setLoading(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setLoading(false);
    if (res.error) toast.error(res.error.message ?? "Google sign-in failed");
    else if (!res.redirected) afterAuth();
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-3">
          <img src={atyviaLogoUrl} alt="Atyvia" width={56} height={56} className="h-14 w-14" />
          <span className="text-xl font-semibold">Atyvia</span>
        </Link>

        <div className="glass-card rounded-2xl p-6">
          <form onSubmit={handleSignIn} className="space-y-3">
            <div>
              <Label htmlFor="si-email">Email</Label>
              <Input id="si-email" type="email" required value={siEmail} onChange={(e) => setSiEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="si-password">Password</Label>
              <Input id="si-password" type="password" required value={siPassword} onChange={(e) => setSiPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>


          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 h-px bg-border" />
            or
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={handleGoogle} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.1 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1.1 7.4 2.8l5.7-5.7C33.4 6.8 28.9 5 24 5 13.5 5 5 13.5 5 24s8.5 19 19 19 19-8.5 19-19c0-1.2-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.7 18.9 13 24 13c2.8 0 5.4 1.1 7.4 2.8l5.7-5.7C33.4 6.8 28.9 5 24 5 16.3 5 9.7 9.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 43c4.8 0 9.2-1.8 12.5-4.8l-5.8-4.9C28.9 34.6 26.6 35.5 24 35.5c-5.3 0-9.7-3-11.3-7.4l-6.6 5.1C9.6 38.7 16.2 43 24 43z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.4l5.8 4.9C40.9 34.7 43 29.7 43 24c0-1.2-.1-2.4-.4-3.5z"/>
            </svg>
            Continue with Google
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to our terms.{" "}
          <Link to="/contact" className="underline hover:text-foreground">Need help?</Link>
        </p>
      </div>
    </div>
  );
}
