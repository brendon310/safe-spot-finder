import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    // Clean app data in parallel (no FK constraints — order doesn't matter).
    // Any non-fatal partial failure still gets cleaned up when auth user is
    // deleted (orphans become unreachable via RLS).
    const results = await Promise.allSettled([
      supabaseAdmin.from("community_post_flames").delete().eq("user_id", uid),
      supabaseAdmin.from("community_posts").delete().eq("user_id", uid),
      supabaseAdmin.from("track_messages").delete().eq("user_id", uid),
      supabaseAdmin.from("track_logs").delete().eq("user_id", uid),
      supabaseAdmin.from("journey_days").delete().eq("user_id", uid),
      supabaseAdmin.from("journeys").delete().eq("user_id", uid),
      supabaseAdmin.from("insights").delete().eq("user_id", uid),
      supabaseAdmin.from("user_tracks").delete().eq("user_id", uid),
      supabaseAdmin.from("profiles").delete().eq("id", uid),
    ]);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) console.warn("deleteAccount: partial cleanup failures", failed);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });