import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { getPublicCatalog, getCoachResponse } from "@/lib/onboarding.functions";
import { trackHueGradient, trackHueVar } from "@/lib/categories";

export const Route = createFileRoute("/begin")({ component: BeginFlow });

type Step = "question" | "thinking" | "response" | "tracks" | "contract";

function BeginFlow() {
  const nav = useNavigate();
  const coachFn = useServerFn(getCoachResponse);
  const catalogFn = useServerFn(getPublicCatalog);

  const [step, setStep] = useState<Step>("question");
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [typedCount, setTypedCount] = useState(0);
  const [chosen, setChosen] = useState<any>(null);
  const [name, setName] = useState("");

  const { data: catalog } = useQuery({
    queryKey: ["public-catalog"],
    queryFn: () => catalogFn(),
    enabled: step === "tracks" || step === "contract",
  });

  const ask = useMutation({
    mutationFn: () => coachFn({ data: { answer } }),
    onMutate: () => { setStep("thinking"); setMessage(""); setTypedCount(0); },
    onSuccess: (r) => { setMessage(r.message || ""); setStep("response"); },
    onError: (e: any) => { toast.error(e.message ?? "Something went wrong"); setStep("question"); },
  });

  // Typewriter — word by word
  const words = useMemo(() => message.split(/(\s+)/), [message]);
  useEffect(() => {
    if (step !== "response" || !message) return;
    setTypedCount(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTypedCount(i);
      if (i >= words.length) clearInterval(id);
    }, 75);
    return () => clearInterval(id);
  }, [step, message, words.length]);
  const typingDone = typedCount >= words.length && words.length > 0;

  const proceedToAuth = () => {
    if (!chosen) return;
    const payload = {
      trackId: chosen.id,
      slug: chosen.slug,
      trackName: chosen.name,
      answer,
      name: name.trim(),
      signed_at: new Date().toISOString(),
    };
    try { localStorage.setItem("pending_onboarding", JSON.stringify(payload)); } catch {}
    nav({ to: "/login" });
  };

  const grouped = useMemo(() => {
    return (catalog ?? []).reduce((acc: Record<string, any[]>, t: any) => {
      (acc[t.category] ||= []).push(t); return acc;
    }, {});
  }, [catalog]);

  return (
    <div data-cloud-client="lovable" className="relative min-h-screen flex items-center justify-center px-6 py-16 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10
        bg-[radial-gradient(60%_60%_at_50%_25%,oklch(0.62_0.215_275_/_0.45),transparent_70%),radial-gradient(45%_55%_at_85%_85%,oklch(0.70_0.215_340_/_0.30),transparent_70%)]" />

      <Link to="/" className="absolute top-6 left-6 text-[11px] uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition">← Elevate</Link>

      <AnimatePresence mode="wait">
        {/* STEP 1 — THE QUESTION */}
        {step === "question" && (
          <motion.div key="q" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.7, ease: [0.2,0.8,0.2,1] }}
            className="max-w-3xl w-full text-center">
            <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-10">One question</p>
            <h1 className="font-display text-[clamp(2rem,6vw,4.5rem)] leading-[1.05] tracking-[-0.04em] font-semibold">
              What is the one thing that,<br/>
              if you changed it,<br/>
              <span className="text-electric text-yellow-400 italic">would change everything?</span>
            </h1>
            <form
              onSubmit={(e) => { e.preventDefault(); if (answer.trim().length >= 10) ask.mutate(); }}
              className="mt-14">
              <textarea
                autoFocus value={answer}
                onChange={(e) => setAnswer(e.target.value.slice(0, 1000))}
                placeholder="Be honest. No one else will read this."
                className="w-full bg-transparent border-0 border-b-2 border-border focus:border-[color:var(--primary)]
                  outline-none text-center font-display text-2xl placeholder:text-muted-foreground
                  py-5 px-2 resize-none min-h-[140px] transition-colors"
              />
              <div className="mt-3 text-[11px] text-muted-foreground font-mono tracking-wider">
                {answer.trim().length < 10 ? `${Math.max(0, 10 - answer.trim().length)} more to continue` : "Ready when you are"}
              </div>
              <AnimatePresence>
                {answer.trim().length >= 10 && (
                  <motion.button
                    key="continue"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    type="submit"
                    className="btn-chunk mt-10 inline-flex items-center gap-2 rounded-full grad-electric text-white
                      px-9 py-4 text-sm font-bold shadow-[var(--shadow-violet)]">
                    Continue <ArrowRight className="h-4 w-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </form>
          </motion.div>
        )}

        {/* STEP 2a — THINKING */}
        {step === "thinking" && (
          <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-center">
            <div className="mx-auto h-28 w-28 rounded-full grad-electric breathe"
              style={{ boxShadow: "var(--shadow-violet)" }} />
            <p className="mt-10 font-display text-xl text-muted-foreground">Your coach is reading this…</p>
          </motion.div>
        )}

        {/* STEP 2b — TYPEWRITER RESPONSE */}
        {step === "response" && (
          <motion.div key="r" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-2xl w-full text-center">
            <div className="mx-auto h-14 w-14 rounded-full grad-electric mb-10"
              style={{ boxShadow: "var(--shadow-violet)" }} />
            <p className="font-display text-[clamp(1.25rem,2.5vw,1.75rem)] leading-[1.55] tracking-[-0.01em] text-foreground text-left">
              {words.slice(0, typedCount).join("")}
              {!typingDone && <span className="inline-block w-[2px] h-[1.1em] align-[-0.15em] ml-1 bg-foreground animate-pulse" />}
            </p>
            <AnimatePresence>
              {typingDone && (
                <motion.button
                  key="rcontinue"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  onClick={() => setStep("tracks")}
                  className="btn-chunk mt-12 inline-flex items-center gap-2 rounded-full grad-electric text-white
                    px-9 py-4 text-sm font-bold shadow-[var(--shadow-violet)]">
                  Continue <ArrowRight className="h-4 w-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* STEP 3 — CHOOSE FIRST PATH */}
        {step === "tracks" && (
          <motion.div key="tracks" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-5xl w-full">
            <div className="text-center mb-10">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-4">Step three</p>
              <h2 className="font-display text-[clamp(1.75rem,4vw,3rem)] tracking-[-0.03em] leading-tight">
                Let's start with <span className="text-electric text-yellow-400 italic">one thing</span>.
              </h2>
              <p className="mt-4 text-muted-foreground">You can add more later. For now, one commitment is enough.</p>
            </div>

            {!catalog ? (
              <div className="text-center text-muted-foreground">Loading paths…</div>
            ) : (
              <div className="space-y-10">
                {Object.entries(grouped).map(([cat, tracks]) => (
                  <section key={cat}>
                    <h3 className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-mono mb-4">{cat}</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {tracks.map((t: any, i: number) => {
                        const seed = t.slug || t.name;
                        const hueVar = trackHueVar(seed, cat);
                        const grad = trackHueGradient(seed, cat);
                        const active = chosen?.id === t.id;
                        return (
                          <motion.button
                            key={t.id}
                            type="button"
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.015, duration: 0.3 }}
                            onClick={() => setChosen(t)}
                            className={`relative text-left rounded-3xl p-4 depth-card btn-chunk overflow-hidden transition
                              ${active ? "ring-2 ring-offset-2 ring-offset-background" : ""}`}
                            style={active ? { boxShadow: `0 0 0 2px var(${hueVar})` } : undefined}>
                            <div aria-hidden className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-60 blur-xl"
                              style={{ background: grad }}/>
                            <div className="relative flex items-start gap-3">
                              <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-white font-display text-sm shrink-0"
                                style={{ background: grad }}>
                                {t.name.slice(0,2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-[14px] leading-tight">{t.name}</p>
                                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-snug">{t.short_description}</p>
                              </div>
                              {active && (
                                <div className="h-6 w-6 rounded-full flex items-center justify-center" style={{ background: `var(${hueVar})` }}>
                                  <Check className="h-3.5 w-3.5 text-white" />
                                </div>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            <AnimatePresence>
              {chosen && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="sticky bottom-6 mt-10 flex justify-center">
                  <button
                    onClick={() => setStep("contract")}
                    className="btn-chunk inline-flex items-center gap-2 rounded-full grad-electric text-white
                      px-9 py-4 text-sm font-bold shadow-[var(--shadow-violet)]">
                    Continue with {chosen.name} <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* STEP 4 — CONTRACT */}
        {step === "contract" && chosen && (
          <motion.div key="contract" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-xl w-full">
            <div className="text-center mb-8">
              <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground mb-3">The contract</p>
              <h2 className="font-display text-[clamp(1.75rem,4vw,3rem)] tracking-[-0.03em] leading-tight">
                Make it real.<br/><span className="text-electric text-yellow-400 italic">Sign it.</span>
              </h2>
            </div>

            <div className="bg-white text-zinc-900 rounded-[1.75rem] p-8 shadow-2xl border border-zinc-200 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-zinc-900 text-white text-[10px] uppercase tracking-[0.3em] font-mono">
                Transformation contract
              </div>
              <p className="font-display text-xl md:text-2xl leading-relaxed mt-4">
                I,{" "}
                <input
                  autoFocus value={name} onChange={(e)=>setName(e.target.value.slice(0,60))}
                  placeholder="your name"
                  className="inline-block min-w-[8ch] max-w-[16ch] bg-transparent border-b-2 border-zinc-300 focus:border-zinc-900 outline-none px-1 font-display"
                />
                , commit to{" "}
                <span className="font-semibold italic">{chosen.name}</span>.
              </p>
              <p className="font-display text-xl md:text-2xl leading-relaxed mt-4">
                Starting today. One day at a time.
              </p>
              <div className="mt-6 pt-4 border-t border-zinc-200 flex items-center justify-between text-[11px] text-zinc-500 uppercase tracking-[0.2em] font-mono">
                <span>{new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span>
                <span>Elevate · vow</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                disabled={name.trim().length < 1}
                onClick={proceedToAuth}
                className="btn-chunk inline-flex items-center gap-2 rounded-full grad-electric text-white
                  px-10 py-4 text-sm font-bold shadow-[var(--shadow-violet)] disabled:opacity-30">
                I commit
              </button>
              <button onClick={() => setStep("tracks")} className="text-xs text-muted-foreground hover:text-foreground">
                Back to paths
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}