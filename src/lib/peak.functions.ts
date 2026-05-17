import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEMO_USER_ID } from "@/lib/demo";

export const getPeakStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("peak_reached_at")
    .eq("id", DEMO_USER_ID)
    .maybeSingle();
  return { peakReachedAt: (data?.peak_reached_at as string | null) ?? null };
});

// Demo: no-op, never persist.
export const markPeakReached = createServerFn({ method: "POST" }).handler(async () => {
  return { peakReachedAt: null as string | null, firstTime: false };
});