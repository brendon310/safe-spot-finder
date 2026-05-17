import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const fromBegin = useMemo(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("pending_onboarding");
  }, []);
  useEffect(() => { if (fromBegin) setMode("signup"); }, [fromBegin]);

  useEffect(() => { if (!loading && user) nav({ to: "/app" }); }, [user, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/auth/callback" },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/app" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth/callback",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    nav({ to: "/app" });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10
        bg-[radial-gradient(60%_60%_at_50%_20%,oklch(0.62_0.215_275_/_0.45),transparent_70%),radial-gradient(45%_55%_at_80%_80%,oklch(0.70_0.215_340_/_0.30),transparent_70%)]" />
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-10">
          <div className="h-9 w-9 rounded-2xl grad-electric flex items-center justify-center shadow-[var(--shadow-violet)]">
            <span className="font-display text-white text-lg leading-none font-bold">e</span>
          </div>
          <span className="font-display tracking-tight font-semibold">Elevate</span>
        </Link>

        <div className="depth-card rounded-[1.75rem] p-7">
          <h1 className="font-display text-3xl leading-tight tracking-tight">
            {fromBegin ? <>One last thing —<br/><span className="text-electric text-yellow-400">save your progress.</span></> : mode === "signin" ? "Welcome back." : <>Begin <span className="text-electric text-yellow-400">again</span>.</>}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {fromBegin ? "Your coach is waiting." : mode === "signin" ? "Pick up where you left off." : "One question stands between you and day one."}
          </p>

          <button onClick={google} disabled={busy} className="mt-6 w-full rounded-xl border border-[#dadce0] bg-white hover:bg-[#f8f9fa] transition px-4 py-3 text-sm font-medium text-[#3c4043] flex items-center justify-center gap-3 disabled:opacity-50">
            <svg className="h-[18px] w-[18px]" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
              <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
              <path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/>
              <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <span className="relative bg-card px-2 text-xs text-muted-foreground">or</span>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email"
              className="w-full rounded-xl bg-input border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition" />
            <input type="password" required minLength={6} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password"
              className="w-full rounded-xl bg-input border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition" />
            <button type="submit" disabled={busy} className="btn-chunk w-full rounded-xl grad-electric text-white px-4 py-3.5 text-sm font-bold shadow-[var(--shadow-violet)] disabled:opacity-50">
              {busy ? "..." : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button onClick={()=>setMode(mode==="signin"?"signup":"signin")} className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground">
            {mode==="signin" ? "No account? Sign up" : "Have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
