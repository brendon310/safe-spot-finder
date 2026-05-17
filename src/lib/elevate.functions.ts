import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEMO_USER_ID, DEMO_BLOCKED_MESSAGE } from "@/lib/demo";

// =============================================================
// PUBLIC READ-ONLY DEMO BACKEND
//
// Every server function reads shared demo data through
// supabaseAdmin (bypassing RLS) and scoping by DEMO_USER_ID.
// Mutations are no-ops that return { demo: true }.
// =============================================================

const blocked = () => ({ demo: true, ok: false, message: DEMO_BLOCKED_MESSAGE });

export const listCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("tracks_catalog").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const suggestTrack = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ answer: z.string().min(3).max(800) }).parse(d))
  .handler(async () => {
    const { data: catalog } = await supabaseAdmin
      .from("tracks_catalog").select("*").order("sort_order");
    const match = (catalog ?? []).find((t) => t.slug === "meditation") ?? catalog?.[0];
    return {
      track: match,
      reason: "In the demo, every answer leads to Meditation — a calm mind unlocks everything else.",
      identity: "You are becoming someone who practices stillness.",
    };
  });

export const listUserTracks = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("user_tracks")
    .select("*, track:tracks_catalog(*)")
    .eq("user_id", DEMO_USER_ID)
    .order("started_at");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const activateTracks = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    trackIds: z.array(z.string().uuid()).min(1).max(50),
    contract: z.object({
      answer: z.string().max(800).optional(),
      identity: z.string().max(200).optional(),
      commitment: z.string().max(400).optional(),
      signed_at: z.string().optional(),
    }).optional(),
  }).parse(d))
  .handler(async () => blocked());

export const logCheckIn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    userTrackId: z.string().uuid(),
    completed: z.boolean().default(true),
    mood: z.number().min(1).max(5).optional(),
    note: z.string().max(2000).optional(),
  }).parse(d))
  .handler(async () => blocked());

export const getTrackDetail = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { data: cat, error: e1 } = await supabaseAdmin
      .from("tracks_catalog").select("*").eq("slug", data.slug).single();
    if (e1 || !cat) throw new Error("Track not found");

    const { data: ut } = await supabaseAdmin
      .from("user_tracks").select("*").eq("user_id", DEMO_USER_ID).eq("track_id", cat.id).maybeSingle();

    let logs: any[] = [];
    let messages: any[] = [];
    if (ut) {
      const [l, m] = await Promise.all([
        supabaseAdmin.from("track_logs").select("*").eq("user_track_id", ut.id).order("log_date", { ascending: false }).limit(90),
        supabaseAdmin.from("track_messages").select("*").eq("user_track_id", ut.id).order("created_at").limit(200),
      ]);
      logs = l.data ?? [];
      messages = m.data ?? [];
    }
    return { catalog: cat, userTrack: ut, logs, messages };
  });

export const sendCoachMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    userTrackId: z.string().uuid(),
    content: z.string().min(1).max(4000),
  }).parse(d))
  .handler(async () => {
    throw new Error(DEMO_BLOCKED_MESSAGE);
  });

export const generateWeeklyInsight = createServerFn({ method: "POST" })
  .handler(async () => {
    // Return a static demo letter without writing anything.
    const weekStart = new Date().toISOString().slice(0, 10);
    return {
      weekStart,
      content:
        "### Strongest\nMeditation is the spine of this week — **12 days unbroken**. The skill of returning attention is taking root, and you can feel the gap between thought and reaction widening.\n\n### Struggled\nStrength training slipped a day. The pattern: when the day gets crowded, the gym is the first thing dropped — not because it doesn't matter, but because it's the easiest to defer.\n\n### Try this week\nProtect one tiny ritual every morning:\n- Sit for 5 minutes the moment your feet touch the floor — before phone, before coffee.\n- Pre-pack your gym bag the night before so the friction is zero.\n- Read 10 pages right after dinner instead of waiting for the perfect quiet moment.",
    };
  });

export const getInsightsData = createServerFn({ method: "GET" }).handler(async () => {
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const since90 = new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);

  const [{ data: tracks }, { data: logs }] = await Promise.all([
    supabaseAdmin
      .from("user_tracks")
      .select("id,current_streak,longest_streak,started_at,last_log_date,track:tracks_catalog(name,slug,category,color,icon)")
      .eq("user_id", DEMO_USER_ID),
    supabaseAdmin
      .from("track_logs")
      .select("log_date,completed,user_track_id")
      .eq("user_id", DEMO_USER_ID)
      .gte("log_date", since90),
  ]);

  const trackList = tracks ?? [];
  const logList = (logs ?? []).filter((l: any) => l.completed);

  const byDay = new Map<string, number>();
  for (const l of logList) byDay.set(l.log_date, (byDay.get(l.log_date) ?? 0) + 1);
  const heatmap: { date: string; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    heatmap.push({ date: d, count: byDay.get(d) ?? 0 });
  }

  const totalTracks = Math.max(1, trackList.length);
  const momentum30 = heatmap.slice(-30).map((h) => ({
    date: h.date,
    score: Math.round((Math.min(h.count, totalTracks) / totalTracks) * 1000),
  }));

  const perTrack = trackList.map((t: any) => {
    const trackLogs = logList.filter((l: any) => l.user_track_id === t.id);
    const totalDone = trackLogs.length;
    const startedAt = t.started_at ? new Date(t.started_at) : today;
    const daysSinceStart = Math.max(1, Math.round((today.getTime() - startedAt.getTime()) / 86400000) + 1);
    const completionRate = Math.min(100, Math.round((totalDone / daysSinceStart) * 100));
    return {
      id: t.id,
      name: t.track?.name ?? "Track",
      slug: t.track?.slug ?? "",
      category: t.track?.category ?? "",
      color: t.track?.color ?? "",
      icon: t.track?.icon ?? "",
      currentStreak: t.current_streak ?? 0,
      longestStreak: t.longest_streak ?? 0,
      totalDone,
      completionRate,
    };
  });

  const dow = today.getDay();
  const thisWeekStart = new Date(today.getTime() - dow * 86400000);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 86400000);
  const inRange = (iso: string, start: Date, end: Date) => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t < end.getTime();
  };
  const thisWeekDone = logList.filter((l: any) => inRange(l.log_date, thisWeekStart, new Date(thisWeekStart.getTime() + 7 * 86400000))).length;
  const lastWeekDone = logList.filter((l: any) => inRange(l.log_date, lastWeekStart, thisWeekStart)).length;
  const possible = trackList.length * 7;
  const thisConsistency = possible ? Math.round((thisWeekDone / possible) * 100) : 0;
  const lastConsistency = possible ? Math.round((lastWeekDone / possible) * 100) : 0;

  const sumScore = (slice: { score: number }[]) =>
    slice.length ? Math.round(slice.reduce((s, x) => s + x.score, 0) / slice.length) : 0;
  const thisMomentum = sumScore(momentum30.slice(-7));
  const lastMomentum = sumScore(momentum30.slice(-14, -7));

  return {
    todayISO,
    heatmap,
    momentum30,
    perTrack,
    compare: {
      thisWeekDone,
      lastWeekDone,
      thisConsistency,
      lastConsistency,
      thisMomentum,
      lastMomentum,
    },
    cachedInsight: {
      weekStart: todayISO,
      content:
        "### Strongest\nMeditation is the spine of this week — **12 days unbroken**. The skill of returning attention is taking root.\n\n### Struggled\nStrength training slipped a day. When the day gets crowded, the gym is the first thing deferred.\n\n### Try this week\nProtect one tiny ritual every morning:\n- Sit for 5 minutes the moment your feet touch the floor.\n- Pre-pack your gym bag the night before.\n- Read 10 pages right after dinner.",
    },
    hasData: logList.length > 0,
  };
});

// ============================================================
// JOURNEY SYSTEM (read-only)
// ============================================================

const MILESTONES = [1, 3, 7, 14, 21, 30, 60, 90, 180, 365];

export const startJourney = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    trackId: z.string().uuid(),
    totalDays: z.number().int().min(7).max(365),
    startingPoint: z.enum(["beginner","been_trying","relapsed","intermediate","advanced"]),
    motivation: z.string().max(400).default(""),
    obstacle: z.string().max(400).default(""),
  }).parse(d))
  .handler(async () => {
    throw new Error(DEMO_BLOCKED_MESSAGE);
  });

export const ensureDaysGenerated = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ journeyId: z.string().uuid(), throughDay: z.number().int().min(1).max(365) }).parse(d))
  .handler(async () => blocked());

export const getJourney = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { data: cat } = await supabaseAdmin.from("tracks_catalog").select("*").eq("slug", data.slug).single();
    if (!cat) throw new Error("Track not found");
    const { data: ut } = await supabaseAdmin.from("user_tracks").select("*").eq("user_id", DEMO_USER_ID).eq("track_id", cat.id).maybeSingle();
    if (!ut) return { catalog: cat, userTrack: null, journey: null, days: [], currentDayNumber: 1, isMilestone: null, missedDays: 0 };
    const { data: jr } = await supabaseAdmin.from("journeys").select("*").eq("user_track_id", ut.id).maybeSingle();
    if (!jr) return { catalog: cat, userTrack: ut, journey: null, days: [], currentDayNumber: 1, isMilestone: null, missedDays: 0 };
    const { data: days } = await supabaseAdmin.from("journey_days").select("*").eq("journey_id", jr.id).order("day_number");
    const completedCount = (days ?? []).filter((d) => d.completed_at).length;
    const currentDayNumber = Math.min(jr.total_days, completedCount + 1);
    const isMilestone = MILESTONES.includes(completedCount) ? completedCount : null;
    return { catalog: cat, userTrack: ut, journey: jr, days: days ?? [], currentDayNumber, isMilestone, missedDays: 0 };
  });

export const completeJourneyDay = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ dayId: z.string().uuid(), note: z.string().max(2000).optional() }).parse(d))
  .handler(async () => {
    throw new Error(DEMO_BLOCKED_MESSAGE);
  });

export const getReEntryMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string(), missedDays: z.number().int().min(1).max(60) }).parse(d))
  .handler(async () => ({
    message: "Welcome back. The only failure is not coming back. Start with one small action today.",
  }));

export const getMilestoneMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string(), dayNumber: z.number().int().min(1).max(365) }).parse(d))
  .handler(async ({ data }) => ({
    message: `Day ${data.dayNumber} reached. You are not the same person who started.`,
    science: "Around this point, the brain begins to encode the new behavior as part of identity rather than effort.",
  }));

// ============================================================
// COMMUNITY BOARD (read-only)
// ============================================================

export const listCommunityPosts = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ trackSlug: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { data: posts, error } = await supabaseAdmin
      .from("community_posts")
      .select("*")
      .eq("track_slug", data.trackSlug)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (posts ?? []).map((p) => ({ ...p, user_has_flamed: false }));
  });

export const createCommunityPost = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    trackSlug: z.string().min(1).max(120),
    content: z.string().min(10).max(280),
  }).parse(d))
  .handler(async () => ({ approved: false, reason: DEMO_BLOCKED_MESSAGE }));

export const toggleFlame = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async () => ({ flamed: false, flameCount: 0 }));

export const validateCheckin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    slug: z.string().min(1).max(100),
    dayNumber: z.number().int().min(1).max(365),
    text: z.string().min(1).max(2000),
  }).parse(d))
  .handler(async () => ({ valid: true, reason: "" }));