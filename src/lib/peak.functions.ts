import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPeakStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("peak_reached_at")
      .eq("id", context.userId)
      .maybeSingle();
    return { peakReachedAt: (data?.peak_reached_at as string | null) ?? null };
  });

export const markPeakReached = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Atomic: only set if currently NULL — race-free.
    const now = new Date().toISOString();
    const { data: updated, error } = await context.supabase
      .from("profiles")
      .update({ peak_reached_at: now })
      .eq("id", context.userId)
      .is("peak_reached_at", null)
      .select("peak_reached_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (updated?.peak_reached_at) {
      return { peakReachedAt: updated.peak_reached_at as string, firstTime: true };
    }
    // Already set — fetch existing.
    const { data: existing } = await context.supabase
      .from("profiles")
      .select("peak_reached_at")
      .eq("id", context.userId)
      .maybeSingle();
    return { peakReachedAt: (existing?.peak_reached_at as string) ?? now, firstTime: false };
  });