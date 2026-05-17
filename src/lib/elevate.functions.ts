import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { checkContent } from "./profanity-filter";
import { anthropicText, anthropicJSON } from "@/lib/anthropic";
import { withArchetype, archetypeForSlug } from "@/lib/coach-archetypes";

export const listCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tracks_catalog").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const suggestTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ answer: z.string().min(3).max(800) }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const { data: catalog } = await context.supabase
      .from("tracks_catalog").select("slug,name,category,short_description").order("sort_order");
    const list = (catalog ?? []).map(t => `${t.slug} :: ${t.name} (${t.category}) — ${t.short_description}`).join("\n");
    const parsed = await anthropicJSON(
      key,
      `You are a wise, warm life coach. The user just answered: "What is the one thing that, if you changed it, would change everything?". Pick the SINGLE most fitting track for them from this catalog. Respond ONLY with JSON: {"slug": string, "reason": string (1-2 warm sentences referencing what they said), "identity": string (5-9 words: "You are becoming someone who...")}. Catalog:\n${list}`,
      data.answer,
    );
    const match = (catalog ?? []).find(t => t.slug === parsed.slug) ?? catalog?.[0];
    return { track: match, reason: parsed.reason ?? "", identity: parsed.identity ?? "" };
  });

export const listUserTracks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_tracks")
      .select("*, track:tracks_catalog(*)")
      .eq("user_id", context.userId)
      .order("started_at");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const activateTracks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    trackIds: z.array(z.string().uuid()).min(1).max(50),
    contract: z.object({
      answer: z.string().max(800).optional(),
      identity: z.string().max(200).optional(),
      commitment: z.string().max(400).optional(),
      signed_at: z.string().optional(),
    }).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const intake = data.contract ? { contract: { ...data.contract, signed_at: data.contract.signed_at ?? new Date().toISOString() } } : undefined;
    const rows = data.trackIds.map((track_id) => ({ user_id: context.userId, track_id, ...(intake ? { intake } : {}) }));
    const { error } = await context.supabase.from("user_tracks").upsert(rows, { onConflict: "user_id,track_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const logCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userTrackId: z.string().uuid(),
    completed: z.boolean().default(true),
    mood: z.number().min(1).max(5).optional(),
    note: z.string().max(2000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error: logErr } = await context.supabase.from("track_logs").upsert({
      user_id: context.userId,
      user_track_id: data.userTrackId,
      log_date: today,
      completed: data.completed,
      mood: data.mood,
      note: data.note,
    }, { onConflict: "user_track_id,log_date" });
    if (logErr) throw new Error(logErr.message);

    // recompute streak
    const { data: ut } = await context.supabase
      .from("user_tracks").select("current_streak,longest_streak,last_log_date,freezes_remaining")
      .eq("id", data.userTrackId).eq("user_id", context.userId).single();
    if (!ut) return { ok: true };

    const last = ut.last_log_date ? new Date(ut.last_log_date) : null;
    const todayD = new Date(today);
    let streak = ut.current_streak ?? 0;
    let freezes = ut.freezes_remaining ?? 0;
    if (!data.completed) {
      // no change
    } else if (!last) {
      streak = 1;
    } else {
      const days = Math.round((+todayD - +last) / 86400000);
      if (days === 0) {
        // same day re-log
      } else if (days === 1) {
        streak += 1;
      } else if (days === 2 && freezes > 0) {
        streak += 1; freezes -= 1;
      } else {
        streak = 1;
      }
    }
    const longest = Math.max(ut.longest_streak ?? 0, streak);
    await context.supabase.from("user_tracks").update({
      current_streak: streak, longest_streak: longest, last_log_date: today, freezes_remaining: freezes,
    }).eq("id", data.userTrackId).eq("user_id", context.userId);
    return { ok: true, streak };
  });

export const getTrackDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cat, error: e1 } = await context.supabase
      .from("tracks_catalog").select("*").eq("slug", data.slug).single();
    if (e1 || !cat) throw new Error("Track not found");

    const { data: ut } = await context.supabase
      .from("user_tracks").select("*").eq("user_id", context.userId).eq("track_id", cat.id).maybeSingle();

    let logs: any[] = [];
    let messages: any[] = [];
    if (ut) {
      const [l, m] = await Promise.all([
        context.supabase.from("track_logs").select("*").eq("user_track_id", ut.id).order("log_date", { ascending: false }).limit(90),
        context.supabase.from("track_messages").select("*").eq("user_track_id", ut.id).order("created_at").limit(200),
      ]);
      logs = l.data ?? [];
      messages = m.data ?? [];
    }
    return { catalog: cat, userTrack: ut, logs, messages };
  });

export const sendCoachMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userTrackId: z.string().uuid(),
    content: z.string().min(1).max(4000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    const { data: ut } = await context.supabase
      .from("user_tracks").select("*, track:tracks_catalog(*)")
      .eq("id", data.userTrackId).eq("user_id", context.userId).single();
    if (!ut) throw new Error("Track not active");

    const { data: history } = await context.supabase
      .from("track_messages").select("role,content")
      .eq("user_track_id", data.userTrackId).order("created_at").limit(40);

    await context.supabase.from("track_messages").insert({
      user_id: context.userId, user_track_id: data.userTrackId, role: "user", content: data.content,
    });

    const systemPrompt = withArchetype(ut.track.slug, ut.track.ai_system_prompt) + `\n\nUser's current streak: ${ut.current_streak} days. Longest: ${ut.longest_streak}.${(() => { const c: any = (ut.intake as any)?.contract; return c?.answer ? `\n\nThe user's transformation contract said: "${c.answer}". Identity: "${c.identity ?? ""}". Reference it gently when meaningful.` : ""; })()}`;
    const chatMessages = [
      ...(history ?? []).map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content as string })),
      { role: "user" as const, content: data.content },
    ];
    const reply = await anthropicText(key, systemPrompt, chatMessages, "claude-sonnet-4-6", 1024);

    await context.supabase.from("track_messages").insert({
      user_id: context.userId, user_track_id: data.userTrackId, role: "assistant", content: reply,
    });

    return { reply };
  });

export const generateWeeklyInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    const { data: tracks } = await context.supabase
      .from("user_tracks").select("current_streak,longest_streak,track:tracks_catalog(name,category)")
      .eq("user_id", context.userId);
    // Cache key is the current date — refreshes automatically the next day.
    const weekStart = new Date().toISOString().slice(0, 10);
    const sinceISO = new Date(Date.now() - 7 * 86400000).toISOString().slice(0,10);
    const { data: logs } = await context.supabase
      .from("track_logs").select("log_date,completed,mood,note,user_track:user_tracks(track:tracks_catalog(name))")
      .eq("user_id", context.userId).gte("log_date", sinceISO);

    const summary = `Tracks: ${JSON.stringify(tracks)}\nLast 7 days logs: ${JSON.stringify(logs)}`;
    const content = await anthropicText(
      key,
      "You are the Elevate weekly insight coach — warm, sharp, specific. Output MARKDOWN with EXACTLY these three H3 sections in order, no preamble, no closing:\n\n### Strongest\n2–3 sentences naming the most consistent behavior, with a number (streak/days). Reference the track by name.\n\n### Struggled\n2–3 sentences naming the weakest pattern honestly. No shame. Use concrete observations.\n\n### Try this week\nA short intro sentence, then 3 bullet points starting with '- '. Each bullet = one concrete, specific micro-action for the coming week tied to their data.\n\nRules: under 220 words total. Use **bold** for emphasis on key words. Never use emojis. Never invent data not present.",
      [{ role: "user", content: summary }],
      "claude-sonnet-4-6",
      512,
    );
    await context.supabase.from("insights").upsert(
      { user_id: context.userId, week_start: weekStart, content },
      { onConflict: "user_id,week_start" }
    );
    return { content, weekStart };
  });

export const getInsightsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const since90 = new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);

    const [{ data: tracks }, { data: logs }, { data: latestInsight }] = await Promise.all([
      context.supabase
        .from("user_tracks")
        .select("id,current_streak,longest_streak,started_at,last_log_date,track:tracks_catalog(name,slug,category,color,icon)")
        .eq("user_id", context.userId),
      context.supabase
        .from("track_logs")
        .select("log_date,completed,user_track_id")
        .eq("user_id", context.userId)
        .gte("log_date", since90),
      context.supabase
        .from("insights")
        .select("content,week_start,created_at")
        .eq("user_id", context.userId)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const trackList = tracks ?? [];
    const logList = (logs ?? []).filter((l: any) => l.completed);

    // Heatmap: counts per day, last 90 days
    const byDay = new Map<string, number>();
    for (const l of logList) byDay.set(l.log_date, (byDay.get(l.log_date) ?? 0) + 1);
    const heatmap: { date: string; count: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
      heatmap.push({ date: d, count: byDay.get(d) ?? 0 });
    }

    // Momentum trend: daily completion ratio over last 30 days × 1000
    const totalTracks = Math.max(1, trackList.length);
    const momentum30 = heatmap.slice(-30).map((h) => ({
      date: h.date,
      score: Math.round((Math.min(h.count, totalTracks) / totalTracks) * 1000),
    }));

    // Per-track stats: streak, longest, total completed, completion rate since started
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

    // This week vs last week (Sun-anchored)
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

    const cachedInsight =
      latestInsight && latestInsight.week_start === todayISO
        ? { content: latestInsight.content as string, weekStart: latestInsight.week_start as string }
        : null;

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
      cachedInsight,
      hasData: logList.length > 0,
    };
  });

// ============================================================
// JOURNEY SYSTEM
// ============================================================

const CHUNK_SIZE = 10;
const MILESTONES = [1, 3, 7, 14, 21, 30, 60, 90, 180, 365];

async function generateDaysChunk(opts: {
  key: string;
  trackName: string;
  trackPrompt: string;
  totalDays: number;
  startingPoint: string;
  motivation: string;
  obstacle: string;
  fromDay: number;
  toDay: number;
}) {
  const system = `${opts.trackPrompt}

You are designing a science-backed, day-by-day transformation journey for the track "${opts.trackName}".
Total journey length: ${opts.totalDays} days. User starting point: ${opts.startingPoint}.
User motivation: "${opts.motivation || "n/a"}". Biggest obstacle: "${opts.obstacle || "n/a"}".

Output STRICT JSON: { "days": [ { "day_number": int, "title": str, "description": str (2-3 sentences, psychological + practical), "task": str (one concrete actionable task), "reflection": str (one journaling question), "science": str (one relevant scientific or psychological insight, 1-2 sentences), "checkin_prompt": str (one specific AI check-in question about that day) } ] }

Rules:
- Generate exactly days ${opts.fromDay} through ${opts.toDay} inclusive.
- Increase complexity and depth as day_number rises.
- Reference the user's obstacle when relevant.
- Tone: warm, expert, never preachy. No emojis.`;
  const out = await anthropicJSON(opts.key, system, `Generate days ${opts.fromDay}-${opts.toDay} as JSON.`, "claude-sonnet-4-6", 4096);
  const days: any[] = Array.isArray(out?.days) ? out.days : [];
  return days.filter(d => d && typeof d.day_number === "number" && d.day_number >= opts.fromDay && d.day_number <= opts.toDay);
}

export const startJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    trackId: z.string().uuid(),
    totalDays: z.number().int().min(7).max(365),
    startingPoint: z.enum(["beginner","been_trying","relapsed","intermediate","advanced"]),
    motivation: z.string().max(400).default(""),
    obstacle: z.string().max(400).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");

    // Ensure user_track
    const { data: existingUT } = await context.supabase
      .from("user_tracks").select("*").eq("user_id", context.userId).eq("track_id", data.trackId).maybeSingle();
    let userTrack = existingUT;
    if (!userTrack) {
      const { data: ins, error } = await context.supabase.from("user_tracks")
        .insert({ user_id: context.userId, track_id: data.trackId }).select("*").single();
      if (error) throw new Error(error.message);
      userTrack = ins;
    }

    // If journey exists, return it
    const { data: existingJ } = await context.supabase.from("journeys")
      .select("*").eq("user_track_id", userTrack.id).maybeSingle();
    if (existingJ) return { journeyId: existingJ.id, userTrackId: userTrack.id };

    const { data: cat } = await context.supabase
      .from("tracks_catalog").select("slug,name,ai_system_prompt").eq("id", data.trackId).single();
    if (!cat) throw new Error("Track not found");

    const { data: jr, error: jErr } = await context.supabase.from("journeys").insert({
      user_id: context.userId,
      user_track_id: userTrack.id,
      total_days: data.totalDays,
      starting_point: data.startingPoint,
      motivation: data.motivation,
      obstacle: data.obstacle,
    }).select("*").single();
    if (jErr) throw new Error(jErr.message);

    const to = Math.min(CHUNK_SIZE, data.totalDays);
    const days = await generateDaysChunk({
      key, trackName: cat.name, trackPrompt: withArchetype(cat.slug, cat.ai_system_prompt),
      totalDays: data.totalDays, startingPoint: data.startingPoint,
      motivation: data.motivation, obstacle: data.obstacle, fromDay: 1, toDay: to,
    });
    if (days.length) {
      await context.supabase.from("journey_days").insert(days.map(d => ({
        journey_id: jr.id, user_id: context.userId,
        day_number: d.day_number, title: String(d.title), description: String(d.description),
        task: String(d.task), reflection: String(d.reflection), science: String(d.science),
        checkin_prompt: String(d.checkin_prompt),
      })));
      await context.supabase.from("journeys")
        .update({ generated_through: Math.max(...days.map(d => d.day_number)) })
        .eq("id", jr.id);
    }
    return { journeyId: jr.id, userTrackId: userTrack.id };
  });

export const ensureDaysGenerated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ journeyId: z.string().uuid(), throughDay: z.number().int().min(1).max(365) }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const { data: jr } = await context.supabase.from("journeys").select("*").eq("id", data.journeyId).eq("user_id", context.userId).single();
    if (!jr) throw new Error("Journey not found");
    if (jr.generated_through >= data.throughDay || jr.generated_through >= jr.total_days) return { ok: true };

    const { data: ut } = await context.supabase.from("user_tracks").select("track:tracks_catalog(slug,name,ai_system_prompt)").eq("id", jr.user_track_id).single();
    const cat: any = ut?.track;
    if (!cat) throw new Error("Track missing");

    const from = jr.generated_through + 1;
    const to = Math.min(jr.total_days, Math.max(data.throughDay, from + CHUNK_SIZE - 1));
    const days = await generateDaysChunk({
      key, trackName: cat.name, trackPrompt: withArchetype(cat.slug, cat.ai_system_prompt),
      totalDays: jr.total_days, startingPoint: jr.starting_point,
      motivation: jr.motivation, obstacle: jr.obstacle, fromDay: from, toDay: to,
    });
    if (days.length) {
      await context.supabase.from("journey_days").upsert(days.map(d => ({
        journey_id: jr.id, user_id: context.userId,
        day_number: d.day_number, title: String(d.title), description: String(d.description),
        task: String(d.task), reflection: String(d.reflection), science: String(d.science),
        checkin_prompt: String(d.checkin_prompt),
      })), { onConflict: "journey_id,day_number", ignoreDuplicates: true });
      await context.supabase.from("journeys")
        .update({ generated_through: Math.max(jr.generated_through, ...days.map(d => d.day_number)) })
        .eq("id", jr.id);
    }
    return { ok: true };
  });

export const getJourney = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cat } = await context.supabase.from("tracks_catalog").select("*").eq("slug", data.slug).single();
    if (!cat) throw new Error("Track not found");
    const { data: ut } = await context.supabase.from("user_tracks").select("*").eq("user_id", context.userId).eq("track_id", cat.id).maybeSingle();
    if (!ut) return { catalog: cat, userTrack: null, journey: null, days: [], currentDayNumber: 1, isMilestone: null, missedDays: 0 };
    const { data: jr } = await context.supabase.from("journeys").select("*").eq("user_track_id", ut.id).maybeSingle();
    if (!jr) return { catalog: cat, userTrack: ut, journey: null, days: [], currentDayNumber: 1, isMilestone: null, missedDays: 0 };
    const { data: days } = await context.supabase.from("journey_days").select("*").eq("journey_id", jr.id).order("day_number");
    const completedCount = (days ?? []).filter(d => d.completed_at).length;
    const currentDayNumber = Math.min(jr.total_days, completedCount + 1);
    const isMilestone = MILESTONES.includes(completedCount) ? completedCount : null;
    // missed days
    let missedDays = 0;
    if (ut.last_log_date) {
      const days = Math.round((Date.now() - new Date(ut.last_log_date).getTime()) / 86400000);
      missedDays = Math.max(0, days - 1);
    }
    return { catalog: cat, userTrack: ut, journey: jr, days: days ?? [], currentDayNumber, isMilestone, missedDays };
  });

export const completeJourneyDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dayId: z.string().uuid(), note: z.string().max(2000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: day } = await context.supabase.from("journey_days").select("*, journey:journeys(*)").eq("id", data.dayId).eq("user_id", context.userId).single();
    if (!day) throw new Error("Day not found");
    if (day.completed_at) return { ok: true, alreadyDone: true };
    await context.supabase.from("journey_days").update({ completed_at: new Date().toISOString(), user_note: data.note ?? null }).eq("id", data.dayId);
    // log + streak via logCheckIn logic inlined
    const today = new Date().toISOString().slice(0, 10);
    await context.supabase.from("track_logs").upsert({
      user_id: context.userId, user_track_id: day.journey.user_track_id, log_date: today, completed: true, note: data.note ?? null,
    }, { onConflict: "user_track_id,log_date" });
    const { data: ut } = await context.supabase.from("user_tracks").select("current_streak,longest_streak,last_log_date,freezes_remaining").eq("id", day.journey.user_track_id).single();
    if (ut) {
      const last = ut.last_log_date ? new Date(ut.last_log_date) : null;
      let streak = ut.current_streak ?? 0;
      let freezes = ut.freezes_remaining ?? 0;
      if (!last) streak = 1;
      else {
        const diff = Math.round((Date.now() - +last) / 86400000);
        if (diff === 0) {/* same day */}
        else if (diff === 1) streak += 1;
        else if (diff === 2 && freezes > 0) { streak += 1; freezes -= 1; }
        else streak = 1;
      }
      const longest = Math.max(ut.longest_streak ?? 0, streak);
      await context.supabase.from("user_tracks").update({
        current_streak: streak, longest_streak: longest, last_log_date: today, freezes_remaining: freezes,
      }).eq("id", day.journey.user_track_id);
    }
    return { ok: true, dayNumber: day.day_number, milestoneHit: MILESTONES.includes(day.day_number) ? day.day_number : null };
  });

export const getReEntryMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string(), missedDays: z.number().int().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { message: "You missed some days. That's part of every real journey. The only failure is not coming back. Start with one small action today." };
    const { data: cat } = await context.supabase.from("tracks_catalog").select("name,ai_system_prompt").eq("slug", data.slug).single();
    if (!cat) throw new Error("Track not found");
    const message = await anthropicText(
      key,
      cat.ai_system_prompt + "\n\nWrite a 3-4 sentence re-entry message: no shame, normalize the gap, give one concrete tiny re-entry action specific to this track.",
      [{ role: "user", content: `The user missed ${data.missedDays} day(s) on the "${cat.name}" track. Write the re-entry message.` }],
      "claude-haiku-4-5-20251001",
      256,
    );
    return { message: message || "Welcome back. One small step today." };
  });

export const getMilestoneMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string(), dayNumber: z.number().int().min(1).max(365) }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    const { data: cat } = await context.supabase.from("tracks_catalog").select("name,ai_system_prompt").eq("slug", data.slug).single();
    if (!cat) throw new Error("Track not found");
    if (!key) return { message: `Day ${data.dayNumber} reached.`, science: "" };
    const out = await anthropicJSON(key, cat.ai_system_prompt + "\n\nReturn ONLY a JSON object: { \"message\": string (2-3 sentences celebrating the milestone, warm and specific), \"science\": string (1-2 sentences of what happens in the brain/body at this point) }", `Milestone day ${data.dayNumber} on "${cat.name}".`);
    return { message: String(out.message ?? ""), science: String(out.science ?? "") };
  });

// ============================================================
// COMMUNITY BOARD
// ============================================================

export const listCommunityPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trackSlug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: posts, error } = await context.supabase
      .from("community_posts")
      .select("*")
      .eq("track_slug", data.trackSlug)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    if (!posts || posts.length === 0) return [];

    const postIds = posts.map((p) => p.id);
    const { data: flames } = await context.supabase
      .from("community_post_flames")
      .select("post_id")
      .eq("user_id", context.userId)
      .in("post_id", postIds);

    const flamedSet = new Set((flames ?? []).map((f) => f.post_id));
    return posts.map((p) => ({ ...p, user_has_flamed: flamedSet.has(p.id) }));
  });

export const createCommunityPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    trackSlug: z.string().min(1).max(120),
    content: z.string().min(10).max(280),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Resolve real current day number from journey progress (same logic as getJourney).
    let dayNumber = 1;
    const { data: cat } = await context.supabase
      .from("tracks_catalog").select("id").eq("slug", data.trackSlug).single();
    if (cat) {
      const { data: ut } = await context.supabase
        .from("user_tracks").select("id")
        .eq("user_id", context.userId).eq("track_id", cat.id).maybeSingle();
      if (ut) {
        const { data: jr } = await context.supabase
          .from("journeys").select("id,total_days")
          .eq("user_track_id", ut.id).maybeSingle();
        if (jr) {
          const { data: jdays } = await context.supabase
            .from("journey_days").select("completed_at")
            .eq("journey_id", jr.id);
          const completedCount = (jdays ?? []).filter((d: any) => d.completed_at).length;
          dayNumber = Math.min(jr.total_days, completedCount + 1);
        }
      }
    }

    // Layer 1: lightweight blocklist filter (server-side authoritative).
    const basic = checkContent(data.content);
    if (!basic.ok) {
      return { approved: false, reason: basic.reason ?? "blocked" };
    }

    // Rate limit: max 3 posts per hour per user per track.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount, error: countError } = await context.supabase
      .from("community_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("track_slug", data.trackSlug)
      .gte("created_at", oneHourAgo);
    if (countError) throw new Error(countError.message);
    if ((recentCount ?? 0) >= 3) {
      return {
        approved: false,
        reason: "Easy there. 3 posts per hour is the limit — your words already landed. Come back later. ⏳",
      };
    }

    // Layer 2 (optional): Claude moderation as a deeper backstop.
    // Fail-OPEN on any error — the blocklist already passed and we don't
    // want every post to break when credits run out.
    try {
      const { data: modData, error: modError } = await context.supabase.functions.invoke(
        "moderate-post",
        { body: { content: data.content, trackSlug: data.trackSlug } },
      );
      if (!modError && modData && modData.approved === false) {
        return { approved: false, reason: modData.reason ?? "blocked" };
      }
    } catch (e) {
      console.warn("moderate-post fallback skipped:", e);
    }

    const { error } = await context.supabase.from("community_posts").insert({
      track_slug: data.trackSlug,
      user_id: context.userId,
      content: data.content,
      day_number: dayNumber,
    });
    if (error) throw new Error(error.message);
    return { approved: true };
  });

export const toggleFlame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .rpc("toggle_community_flame", { _post_id: data.postId });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { flamed: Boolean(row?.flamed), flameCount: Number(row?.flame_count ?? 0) };
  });

export const validateCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    slug: z.string().min(1).max(100),
    dayNumber: z.number().int().min(1).max(365),
    text: z.string().min(1).max(2000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const trimmed = data.text.trim();
    if (trimmed.length < 8) {
      return { valid: false, reason: "Too short to be a real reflection." };
    }
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { valid: true, reason: "" };
    const { data: cat } = await context.supabase
      .from("tracks_catalog").select("name").eq("slug", data.slug).single();
    const trackName = cat?.name ?? data.slug;
    try {
      const parsed = await anthropicJSON(
        key,
        "You are a strict but funny check-in validator for a self-improvement app. The user is on a specific journey (provided in context). Evaluate if their response is genuine, relevant, and meaningful. A real response mentions specific situations, feelings, thoughts, or experiences related to their journey. Respond ONLY with a JSON object: {\"valid\": true/false, \"reason\": \"one short sentence explaining why if invalid\"}. Be strict — vague one-word answers, random text, jokes, and nonsense are invalid. A genuine 2-3 sentence personal reflection is valid.",
        `Track: ${trackName}\nDay: ${data.dayNumber}\n\nUser response:\n"""${trimmed}"""`,
        "claude-haiku-4-5-20251001",
        128,
      );
      return { valid: Boolean(parsed?.valid), reason: String(parsed?.reason ?? "") };
    } catch {
      return { valid: true, reason: "" }; // fail-open on network errors
    }
  });
