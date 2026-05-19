import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-foreground">
      {/* warm ambient backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px]
        bg-[radial-gradient(70%_60%_at_50%_-10%,oklch(0.62_0.215_275_/_0.5),transparent_70%),radial-gradient(40%_50%_at_85%_10%,oklch(0.70_0.215_340_/_0.35),transparent_60%),radial-gradient(40%_40%_at_15%_30%,oklch(0.82_0.165_165_/_0.20),transparent_70%)]" />

      <header className="container mx-auto flex items-center justify-between px-6 py-7">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-2xl grad-electric flex items-center justify-center shadow-[var(--shadow-violet)]">
            <span className="font-display text-white text-lg leading-none font-bold">e</span>
          </div>
          <span className="font-display text-[18px] tracking-tight font-semibold">Elevate</span>
        </div>
        <Link to="/login" className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition">
          Sign in
        </Link>
      </header>

      <main className="container mx-auto px-6 relative">
        <section className="pt-20 pb-32 max-w-4xl">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-mono">A transformation engine</p>
          <h1 className="mt-6 font-display text-[clamp(3rem,9vw,7.5rem)] leading-[0.92] tracking-[-0.05em] font-bold">
            Become<br/>
            <span className="text-electric text-yellow-400">who you</span><br/>
            already are.
          </h1>
          <p className="mt-10 text-lg text-muted-foreground max-w-xl leading-relaxed">
            Fifty specialist AI coaches. One quiet companion that remembers everything.
            Built for the version of you that's already begun.
          </p>
          <div className="mt-12 flex flex-wrap items-center gap-5">
            <Link to="/begin" className="btn-chunk group inline-flex items-center gap-2 rounded-full grad-electric px-8 py-4 text-sm font-bold text-white shadow-[var(--shadow-violet)]">
              Begin <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition" />
            </Link>
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition">
              Already started? Sign in →
            </Link>
          </div>
        </section>

        {/* editorial trio — overlapping cards */}
        <section className="relative pb-32 max-w-5xl">
          <div className="grid md:grid-cols-12 gap-6">
            <article className="md:col-span-7 warm-card rounded-[2rem] p-8 md:p-10 relative ambient-warm">
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary">01 — Specialist coaches</p>
              <h3 className="mt-4 font-display text-3xl md:text-4xl leading-tight">
                Each habit, its own <span className="italic">world-class mind</span>.
              </h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-md">
                CBT for anxiety. Allen Carr for nicotine. Progressive overload for strength.
                Every coach is trained in the actual framework behind the change.
              </p>
            </article>
            <article className="md:col-span-5 md:mt-12 warm-card rounded-[2rem] p-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary">02 — Streaks that breathe</p>
              <h3 className="mt-4 font-display text-3xl leading-tight italic">Shielded, not shamed.</h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Life happens. Earn Shields. Spend them. Your story keeps its shape.
              </p>
            </article>
            <article className="md:col-span-5 md:-mt-6 warm-card rounded-[2rem] p-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary">03 — Identity, not points</p>
              <h3 className="mt-4 font-display text-3xl leading-tight">
                <span className="italic">You are becoming</span> someone.
              </h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Day 21: you are a person who meditates. We track who, not what.
              </p>
            </article>
            <article className="md:col-span-7 warm-card rounded-[2rem] p-8 md:p-10">
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary">04 — A letter, every Sunday</p>
              <h3 className="mt-4 font-display text-3xl md:text-4xl leading-tight">
                Not a dashboard. <span className="italic">A letter.</span>
              </h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-md">
                Each week, your coach writes to you. Personally. With memory.
                With warmth. With something to believe about who you're becoming.
              </p>
            </article>
          </div>
        </section>

        <section className="pb-24 max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Five worlds. Fifty paths.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {["Fitness & Body","Mental Health","Quit Bad Habits","Mind & Learning","Productivity & Life"].map((c) => (
              <span key={c} className="rounded-full border border-[color:var(--primary)]/30 bg-card px-4 py-2 text-foreground font-mono uppercase tracking-widest text-[10px]">{c}</span>
            ))}
          </div>
        </section>

        {/* bottom CTA */}
        <section className="pb-32 text-center max-w-2xl mx-auto">
          <h2 className="font-display text-[clamp(2rem,5vw,4rem)] leading-tight tracking-[-0.04em]">
            The version of you<br/>who does the work<br/><span className="text-electric text-yellow-400 italic">starts here.</span>
          </h2>
          <div className="mt-10">
            <Link to="/begin" className="btn-chunk group inline-flex items-center gap-2 rounded-full grad-electric px-10 py-5 text-base font-bold text-white shadow-[var(--shadow-violet)]">
              Begin now <ArrowRight className="h-5 w-5 group-hover:translate-x-0.5 transition" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-10 text-center">
        <p className="font-display italic text-sm text-muted-foreground">Elevate · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
