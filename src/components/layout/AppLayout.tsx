import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, PhoneCall, CalendarDays, Users,
  Bell, ChevronDown, FileText, Hammer, SlidersHorizontal, Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSelectedSite } from "@/hooks/useSelectedSite";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarTrigger, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import atyviaLogoUrl from "@/assets/atyvia-logo.svg";

const nav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Calls Log", url: "/calls", icon: PhoneCall },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Customers", url: "/customers", icon: Users },
];

const bookingsNav = [
  { title: "Quotes", url: "/bookings/quotes", icon: FileText },
  { title: "Jobs", url: "/bookings/jobs", icon: Hammer },
  { title: "Invoices", url: "/bookings/invoices", icon: Receipt },
];

const setupNav = [
  { title: "Business Info", url: "/business-info", icon: SlidersHorizontal },
];

function AtyviaSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <img
            src={atyviaLogoUrl}
            alt="Atyvia"
            width={48}
            height={48}
            loading="lazy"
            className="h-12 w-12 shrink-0 rounded-xl object-contain"
          />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold">Atyvia</div>
            <div className="truncate text-[11px] text-muted-foreground">Analytics Suite</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2.5">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Bookings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {bookingsNav.map((item) => {
                const active = pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2.5">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Business setup</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {setupNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2.5">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarUserFooter />
      </SidebarFooter>
    </Sidebar>
  );
}

type SessionUser = { email: string | null; name: string | null; initials: string };

function computeInitials(u: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null): string {
  if (!u) return "";
  const md = (u.user_metadata ?? {}) as Record<string, unknown>;
  const first = ((md.first_name as string | undefined) ?? "").trim();
  const last = ((md.last_name as string | undefined) ?? "").trim();
  if (first || last) {
    return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
  }
  const full = ((md.full_name as string | undefined) ?? "").trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "";
    const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase();
  }
  return (u.email?.[0] ?? "?").toUpperCase();
}

function useSessionUser(): SessionUser {
  const [user, setUser] = useState<SessionUser>({ email: null, name: null, initials: "" });
  useEffect(() => {
    let cancelled = false;
    const apply = (u: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"]) => {
      if (cancelled) return;
      const md = (u?.user_metadata ?? {}) as Record<string, unknown>;
      const name = (md.full_name as string | undefined) ?? null;
      const email = u?.email ?? null;
      setUser({ email, name, initials: computeInitials(u ?? null) });
    };
    supabase.auth.getUser().then(({ data }) => apply(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      supabase.auth.getUser().then(({ data }) => apply(data.user));
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);
  return user;
}

function SidebarUserFooter() {
  const user = useSessionUser();
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-gradient-primary text-xs font-semibold text-primary-foreground">
          {user.initials || "?"}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <div className="truncate text-xs font-medium">{user.name || user.email || "Account"}</div>
        <div className="truncate text-[10px] text-muted-foreground">{user.email ?? ""}</div>
      </div>
    </div>
  );
}

function SiteSwitcher() {
  const { sites, selectedSite, selectSite, isLoading } = useSelectedSite();
  const label = selectedSite?.name ?? (isLoading ? "Loading…" : "No sites");
  const initial = (label.trim()[0] ?? "?").toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2.5 font-medium" disabled={isLoading}>
          <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-primary text-[10px] font-bold text-primary-foreground">{initial}</div>
          <span className="hidden truncate sm:inline">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch site</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sites.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            No sites yet. Add one from Settings.
          </div>
        )}
        {sites.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onSelect={() => void selectSite(s.id)}
            className={s.id === selectedSite?.id ? "font-semibold" : ""}
          >
            {s.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">Manage sites…</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopNav() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useSessionUser();
  const handleSignOut = async () => {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl lg:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="hidden h-6 w-px bg-border sm:block" />
      <SiteSwitcher />


      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-secondary shadow-[0_0_8px_var(--color-secondary)]" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-1.5">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-gradient-primary text-[10px] font-semibold text-primary-foreground">
                  {user.initials || "?"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{user.name || user.email || "Account"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link to="/profile">Profile</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/billing">Billing</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/contact">Contact</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleSignOut}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-1 hidden h-6 w-px bg-border sm:block" />
        <div className="flex items-center gap-2.5 pl-1 pr-1">
          <img
            src={atyviaLogoUrl}
            alt="Atyvia"
            width={40}
            height={40}
            loading="lazy"
            className="h-10 w-10 object-contain drop-shadow-[0_0_10px_rgba(67,56,202,0.25)]"
          />
          <div className="hidden leading-tight sm:block">
            <div className="text-sm font-semibold tracking-tight">Atyvia</div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AtyviaSidebar />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-glow" aria-hidden />
          <TopNav />
          <main className="relative flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
