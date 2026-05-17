import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { Home, Layers, BarChart3, Settings, Sparkles, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: Layout,
});

function Layout() {
  const loc = useLocation();

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
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono border border-border">
          <Eye className="h-3.5 w-3.5" /> Demo mode
        </div>
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
