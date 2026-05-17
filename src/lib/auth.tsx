import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Ctx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({ user: null, session: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });

    const cleanOAuthUrl = () => {
      const url = new URL(window.location.href);
      url.hash = "";
      ["access_token", "refresh_token", "expires_in", "expires_at", "token_type", "type", "provider_token", "provider_refresh_token", "state", "code", "error", "error_description"].forEach((key) => {
        url.searchParams.delete(key);
      });
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    };

    const finishInitialAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
        const tokenParams = hashParams.has("access_token") ? hashParams : url.searchParams;
        const accessToken = tokenParams.get("access_token");
        const refreshToken = tokenParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
          setSession(data.session);
          cleanOAuthUrl();
          return;
        }

        const code = url.searchParams.get("code");
        if (code && url.pathname === "/auth/callback") {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setSession(data.session);
          cleanOAuthUrl();
          return;
        }

        const { data } = await supabase.auth.getSession();
        setSession(data.session);
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    void finishInitialAuth();
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => { await supabase.auth.signOut(); },
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
