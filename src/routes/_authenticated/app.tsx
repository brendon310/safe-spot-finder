import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo } from "react";
import { Flame, Plus, Check } from "lucide-react";
import { motion } from "framer-motion";
import { listUserTracks, logCheckIn } from "@/lib/elevate.functions";
import { trackHueGradient, trackHueVar } from "@/lib/categories";
import { MomentumHero } from "@/components/momentum-hero";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/app")({ component: Dashboard });

const MOTIVATIONS = [
  "Today is a clean page. Write one good line.",
  "Small reps. Big identity.",
  "Show up. The rest follows.",
  "You're closer than you were yesterday.",
  "Repetition is how you become.",
  "Make one move that future-you applauds.",
  "Discipline is self-love in slow motion.",
];

function ArcRing({ value, hueVar, size = 84 }: { value: number; hueVar: string; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} stroke="oklch(1 0 0 / 0.08)" strokeWidth={stroke} fill="none" />
      <motion.circle
        cx={size/2} cy={size/2} r={r}
        stroke={`var(${hueVar})`} strokeWidth={stroke} strokeLinecap="round" fill="none"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (c * v) / 100 }}
        transition={{ type: "spring", stiffness: 60, damping: 16 }}
        style={{ filter: `drop-shadow(0 0 8px var(${hueVar}))` }}
      />
    </svg>
  );
}

function SkeletonCard() {
  return <div className="snap-start shrink-0 w-[260px] h-[340px] rounded-[20px] bg-muted animate-pulse" />;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 rounded-2xl p-4 depth-card">
      <div className="h-12 w-12 rounded-2xl bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-2.5 w-16 bg-muted animate-pulse rounded-full" />
        <div className="h-4 w-40 bg-muted animate-pulse rounded-full" />
      </div>
      <div className="h-8 w-20 bg-muted animate-pulse rounded-full" />
    </div>
  );
}

function Dashboard() {
  const fn = useServerFn(listUserTracks);
  const checkInFn = useServerFn(logCheckIn);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["userTracks"],
    queryFn: () => fn(),
    enabled: !loading && !!user,
  });

  const checkIn = useMutation({
    mutationFn: (userTrackId: string) => checkInFn({ data: { userTrackId, completed: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["userTracks"] }),
  });

  useEffect(() => {
    if (!isLoading && data && data.length === 0) nav({ to: "/onboarding" });
  }, [isLoading, data, nav]);

  const motivation = useMemo(() => {
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    return MOTIVATIONS[seed % MOTIVATIONS.length];
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayFormatted = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || null;

  return (
    <div className="relative max-w-5xl mx-auto px-5 pt-8 pb-32">
      {/* Greeting */}
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="mb-7">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-mono">{todayFormatted}</p>
        <h1 className="mt-2 font-display text-[2.5rem] leading-[1] tracking-[-0.03em]">
          {greeting},<br/>
          <span className="text-electric">{firstName ? `${firstName}.` : "friend."}</span>
        </h1>
        <p className="mt-3 text-base text-foreground max-w-md leading-snug">{motivation}</p>
      </motion.header>

      {/* Momentum hero — score, evolution, flow mode, at-risk alerts */}
      {data && data.length > 0 && <MomentumHero tracks={data as any} />}

      {/* Active paths — tall vivid horizontal scroll */}
      <div className="flex items-end justify-between mb-4">
        <h2 className="font-display text-2xl tracking-tight">Your paths</h2>
        <Link to="/tracks" className="btn-chunk inline-flex items-center gap-1.5 rounded-full bg-[color:var(--primary)] text-primary-foreground px-3.5 py-2 text-xs font-semibold" style={{ boxShadow: "var(--shadow-violet)" }}>
          <Plus className="h-3.5 w-3.5"/> Add
        </Link>
      </div>

      <div className="-mx-5 px-5 overflow-x-auto no-scrollbar mb-10">
        <div className="flex gap-4 pb-2 snap-x snap-mandatory">
          {isLoading ? (
            <><SkeletonCard /><SkeletonCard /></>
          ) : (data ?? []).map((ut: any, i: number) => {
            const seed = ut.track.slug || ut.track.name;
            const hueVar = trackHueVar(seed, ut.track.category);
            const grad = trackHueGradient(seed, ut.track.category);
            const target = Math.max(1, ut.target_days ?? 30);
            const pct = Math.min(100, Math.round(((ut.current_streak ?? 0) / target) * 100));
            const doneToday = ut.last_log_date === todayStr;
            return (
              <motion.div key={ut.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05, type: "spring", stiffness: 90, damping: 16 }}>
                <Link to="/track/$slug" params={{ slug: ut.track.slug }}
                  className="snap-start block w-[260px] h-[340px] rounded-[20px] p-5 relative overflow-hidden btn-chunk"
                  style={{
                    background: grad,
                    boxShadow: `0 24px 50px -16px color-mix(in oklab, var(${hueVar}) 55%, transparent), 0 4px 14px -4px color-mix(in oklab, var(${hueVar}) 35%, transparent)`,
                  }}>
                  {/* Floating orb illustration */}
                  <div aria-hidden className="absolute -right-12 -bottom-12 h-56 w-56 rounded-full opacity-50 blur-2xl"
                    style={{ background: `radial-gradient(circle, oklch(1 0 0 / 0.5), transparent 60%)` }}/>
                  <div aria-hidden className="absolute right-3 top-3 h-20 w-20 rounded-full opacity-70"
                    style={{ background: `radial-gradient(circle, oklch(1 0 0 / 0.35), transparent 70%)` }}/>

                  <div className="relative flex items-start justify-between">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-white font-mono">{ut.track.category}</span>
                    <ArcRing value={pct} hueVar="--background" size={56} />
                  </div>

                  <div className="relative mt-auto pt-12">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white font-mono">Day</p>
                    <p className="font-display text-[5.5rem] leading-[0.85] tracking-[-0.05em] text-white num">
                      {ut.current_streak || 0}
                    </p>
                    <h3 className="mt-3 font-display text-xl text-white leading-tight line-clamp-2">{ut.track.name}</h3>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-[11px] text-white">
                        <Flame className="h-3 w-3 flame text-[color:var(--highlight)]"/>
                        <span className="font-mono num">{ut.current_streak || 0}</span>
                        <span className="text-white">streak</span>
                      </div>
                      {doneToday && (
                        <div className="inline-flex items-center gap-1 rounded-full bg-[color:var(--tertiary)] px-2.5 py-1 text-[11px] text-white font-semibold">
                          <Check className="h-3 w-3" /> Done
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}

          {/* Add new card */}
          {!isLoading && (
            <Link to="/tracks"
              className="snap-start flex flex-col items-center justify-center w-[200px] h-[340px] rounded-[20px] border-2 border-dashed border-[color:var(--primary)]/40 text-muted-foreground hover:border-[color:var(--primary)] hover:text-foreground transition btn-chunk">
              <Plus className="h-8 w-8 mb-2"/>
              <span className="text-sm font-medium">New path</span>
            </Link>
          )}
        </div>
      </div>

      {/* Today's actions — quick check-in */}
      <h2 className="font-display text-2xl tracking-tight mb-4">Today's actions</h2>
      <div className="space-y-2.5">
        {isLoading ? (
          <><SkeletonRow /><SkeletonRow /></>
        ) : (data ?? []).map((ut: any) => {
          const seed = ut.track.slug || ut.track.name;
          const hueVar = trackHueVar(seed, ut.track.category);
          const doneToday = ut.last_log_date === todayStr;
          const isPending = checkIn.isPending && checkIn.variables === ut.id;
          return (
            <div key={ut.id} className="group flex items-center gap-4 rounded-2xl p-4 depth-card">
              <Link to="/track/$slug" params={{ slug: ut.track.slug }} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-white font-display text-base shrink-0"
                  style={{ background: trackHueGradient(seed, ut.track.category), boxShadow: `0 8px 20px -6px color-mix(in oklab, var(${hueVar}) 60%, transparent)` }}>
                  {ut.track.name.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.25em] font-mono" style={{ color: `var(${hueVar})` }}>{ut.track.category}</p>
                  <p className="font-semibold text-[15px] truncate">{ut.track.name}</p>
                </div>
              </Link>
              {doneToday ? (
                <div className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[color:var(--tertiary)]/15 text-[color:var(--tertiary)] px-3.5 py-2 text-xs font-semibold">
                  <Check className="h-3.5 w-3.5" /> Done
                </div>
              ) : (
                <button
                  onClick={() => checkIn.mutate(ut.id)}
                  disabled={isPending}
                  className="shrink-0 btn-chunk rounded-full bg-foreground text-background px-3.5 py-2 text-xs font-semibold disabled:opacity-50 transition"
                  aria-label={`Check in for ${ut.track.name}`}
                >
                  {isPending ? "…" : "Check in"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
