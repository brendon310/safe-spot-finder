// Public demo build — no real authentication.
// AuthProvider and useAuth are stubs kept so existing imports keep compiling.
import type { ReactNode } from "react";

type DemoUser = {
  id: string;
  email: string;
  user_metadata: { full_name: string; display_name: string };
} | null;

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuth() {
  return {
    user: null as DemoUser,
    session: null,
    loading: false,
    signOut: async () => {},
  };
}
