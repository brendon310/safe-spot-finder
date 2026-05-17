import { createFileRoute, Outlet, useNavigate, Link, useLocation, redirect } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { activateTracks } from "@/lib/elevate.functions";
import { Home, Layers, BarChart3, Settings, Sparkles, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { authUser: data.user };
  },
  component: Layout,
});

function Layout() {
  const { user, signOut } = useAuth();
  const { authUser } = Route.useRouteContext();
  const activeUser = user ?? authUser ?? null;
  const nav = useNavigate();
  const loc = useLocation();
  const activate = useServerFn(activateTracks);
  const qc = useQueryClient();
  const draining = useRef(false);

  // Drain pending pre-auth onboarding (from /begin) once signed in.
  useEffect(() => {
    if (!activeUser || draining.current) return;
    let raw: string | null = null;
    try { raw = localStorage.getItem("pending_onboarding"); } catch {}
    if (!raw) return;
    draining.current = true;
    let p: any;
    try { p = JSON.parse(raw); } catch { localStorage.removeItem("pending_onboarding"); return; }
    if (!p?.trackId || !p?.slug) { localStorage.removeItem("pending_onboarding"); return; }
    (async () => {
      try {
        await activate({ data: {
          trackIds: [p.trackId],
          contract: {
            answer: p.answer,
            identity: p.name ? `${p.name} — committed to ${p.trackName}` : undefined,
            commitment: `I, ${p.name}, commit to ${p.trackName}. Starting today. One day at a time.`,
            signed_at: p.signed_at,
          },
        } });
        localStorage.removeItem("pending_onboarding");
        await qc.invalidateQueries({ queryKey: ["userTracks"] });
        nav({ to: "/track/$slug", params: { slug: p.slug } });
      } catch {
        localStorage.removeItem("pending_onboarding");
      }
    })();
  }, [activeUser, activate, nav, qc]);

  const navItems = [
    { to: "/app", icon: Home, label: "Home" },
    { to: "/tracks", icon: Layers, label: "Tracks" },
    { to: "/insights", icon: BarChart3, label: "Insights" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 border-r border-border bg-card  flex-col p-4">
        <Link to="/app" className="flex items-center gap-2 mb-8 px-2">
          <div className="h-8 w-8 rounded-lg grad-productivity flex items-center justify-center"><Sparkles className="h-4 w-4 text-background"/></div>
          <span className="font-semibold tracking-tight">Elevate</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {navItems.map(({to,icon:Icon,label}) => {
            const active = loc.pathname === to;
            return (
              <Link key={to} to={to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${active?"bg-accent text-foreground":"text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}>
                <Icon className="h-4 w-4" />{label}
              </Link>
            );
          })}
        </nav>
        <button onClick={()=>signOut().then(()=>nav({to:"/"}))} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <main className="md:ml-60 pb-24 md:pb-8">
        <Outlet />
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-border bg-card  z-50 flex justify-around py-2">
        {navItems.map(({to,icon:Icon,label}) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-1 px-4 py-1 text-[10px] text-muted-foreground [&.active]:text-foreground" activeProps={{className:"active"}}>
            <Icon className="h-5 w-5"/>{label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
