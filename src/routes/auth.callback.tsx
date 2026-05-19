import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

function AuthCallback() {
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      // PKCE flow: code in query params
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorDesc = params.get("error_description");

      if (errorDesc) {
        toast.error(errorDesc);
        nav({ to: "/login" });
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          toast.error(error.message);
          nav({ to: "/login" });
          return;
        }
        nav({ to: "/app" });
        return;
      }

      // Implicit flow: tokens in URL hash
      const hash = window.location.hash;
      if (hash.includes("access_token")) {
        const hp = new URLSearchParams(hash.slice(1));
        const hashError = hp.get("error_description");
        if (hashError) {
          toast.error(hashError);
          nav({ to: "/login" });
          return;
        }
        const accessToken = hp.get("access_token");
        const refreshToken = hp.get("refresh_token");
        if (!accessToken || !refreshToken) {
          toast.error("Sign-in could not be completed. Please try again.");
          nav({ to: "/login" });
          return;
        }
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (cancelled) return;
        if (error) {
          toast.error(error.message);
          nav({ to: "/login" });
          return;
        }
        nav({ to: "/app" });
        return;
      }

      // Nothing to process — redirect to login
      nav({ to: "/login" });
    }

    finish();
    return () => { cancelled = true; };
  }, [nav]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
    </div>
  );
}
