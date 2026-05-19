import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({ component: LoginPage });

type AuthFlow = "main" | "email" | "phone" | "otp";

function Spinner({ light = false }: { light?: boolean }) {
  return (<svg className={`animate-spin h-4 w-4 ${light ? "text-white" : "text-foreground"}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}

function GoogleSvg() {
  return (<svg className="h-[18px] w-[18px]" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>);
}

function AppleSvg() {
  return (<svg className="h-5 w-5" viewBox="0 0 814 1000" fill="currentColor"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.6-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.3 134.4-316.9 266.7-316.9 100.9 0 184.4 66.6 246.9 66.6 59.2 0 152.1-70.5 259.1-70.5zM552.7 140.8c-40 0-86.8-27.4-117.8-63.8-28-33.2-48.6-81-48.6-128.8 0-6.4.6-12.8 1.6-19.2 48.1 1.9 105 32.4 138.2 72.1 26.4 31.5 50.3 78.6 50.3 127.2 0 6.7-.6 13.4-1.6 20.1-7.2 1.6-14.4 2.4-22.1 2.4z"/></svg>);
}

function Divider() {
  return (<div className="relative my-5 text-center"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border"/></div><span className="relative bg-card px-2 text-xs text-muted-foreground">or</span></div>);
}

function LoginPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [flow, setFlow] = useState<AuthFlow>("main");
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["","","","","",""]);
  const otpRefs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));
  const fromBegin = useMemo(() => { if (typeof window==="undefined") return false; return !!localStorage.getItem("pending_onboarding"); }, []);
  useEffect(() => { if (fromBegin) setMode("signup"); }, [fromBegin]);
  useEffect(() => { if (!loading && user) nav({ to: "/app" }); }, [user, loading, nav]);
  const signInWithOAuth = async (provider: "google"|"apple") => {
    setBusy(provider);
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin+"/auth/callback" } });
    if (error) { toast.error(error.message); setBusy(null); }
  };
  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy("email");
    try {
      if (mode==="signup") { const {error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+"/app"}}); if(error) throw error; toast.success("Check your email to confirm your account."); }
      else { const {error}=await supabase.auth.signInWithPassword({email,password}); if(error) throw error; nav({to:"/app"}); }
    } catch(err:any){toast.error(err.message??"Authentication failed");}finally{setBusy(null);}
  };
  const sendOtp = async () => {
    const digits=phone.replace(/\D/g,""); if(digits.length<10){toast.error("Enter a valid phone number");return;}
    setBusy("phone"); const fullPhone=phone.startsWith("+")?phone:`+1${digits}`;
    const{error}=await supabase.auth.signInWithOtp({phone:fullPhone});
    if(error){toast.error(error.message);}else{setFlow("otp");} setBusy(null);
  };
  const verifyOtp = async () => {
    const token=otp.join(""); if(token.length<6)return; setBusy("otp");
    const fullPhone=phone.startsWith("+")?phone:`+1${phone.replace(/\D/g,"")}`;
    const{error}=await supabase.auth.verifyOtp({phone:fullPhone,token,type:"sms"});
    if(error){toast.error(error.message);}else{nav({to:"/app"});} setBusy(null);
  };
  const handleOtpChange=(i:number,val:string)=>{const digit=val.replace(/\D/g,"").slice(-1);const next=[...otp];next[i]=digit;setOtp(next);if(digit&&i<5)otpRefs[i+1].current?.focus();};
  const btnPrimary="btn-chunk w-full rounded-xl grad-electric text-white px-4 py-3.5 text-sm font-bold shadow-[var(--shadow-violet)] disabled:opacity-40 flex items-center justify-center gap-2";
  const btnOutline="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40 flex items-center justify-center gap-2.5";
  const inputCls="w-full rounded-xl bg-input border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition";
  const heading=fromBegin?<><span>One last thing —</span><br/><span className="text-yellow-400">save your progress.</span></>:mode==="signin"?"Welcome back.":<>Begin <span className="text-yellow-400">again</span>.</>;
  const sub=fromBegin?"Your coach is waiting.":mode==="signin"?"Pick up where you left off.":"One question stands between you and day one.";
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_20%,oklch(0.62_0.215_275_/_0.45),transparent_70%),radial-gradient(45%_55%_at_80%_80%,oklch(0.70_0.215_340_/_0.30),transparent_70%)]" />
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-10"><div className="h-9 w-9 rounded-2xl grad-electric flex items-center justify-center shadow-[var(--shadow-violet)]"><span className="font-display text-white text-lg leading-none font-bold">e</span></div><span className="font-display tracking-tight font-semibold">Elevate</span></Link>
        <div className="depth-card rounded-[1.75rem] p-7 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {flow==="main"&&(<motion.div key="main" initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-16}} transition={{duration:0.22}}>
              <h1 className="font-display text-3xl leading-tight tracking-tight">{heading}</h1>
              <p className="text-sm text-muted-foreground mt-2 mb-6">{sub}</p>
              <button onClick={()=>signInWithOAuth("google")} disabled={!!busy} className="w-full rounded-xl border border-[#dadce0] bg-white hover:bg-[#f8f9fa] transition px-4 py-3 text-sm font-medium text-[#3c4043] flex items-center justify-center gap-3 disabled:opacity-50">{busy==="google"?<Spinner/>:<><GoogleSvg/>Continue with Google</>}</button>
              <button onClick={()=>signInWithOAuth("apple")} disabled={!!busy} className="mt-2.5 w-full rounded-xl bg-black text-white hover:bg-zinc-800 transition px-4 py-3 text-sm font-medium flex items-center justify-center gap-3 disabled:opacity-50">{busy==="apple"?<Spinner light/>:<><AppleSvg/>Continue with Apple</>}</button>
              <Divider/>
              <button onClick={()=>setFlow("email")} disabled={!!busy} className={btnOutline}><svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>Continue with Email</button>
              <button onClick={()=>toast("Phone Sign-In coming soon.",{description:"Use Google or email for now."})} disabled={!!busy} className={`${btnOutline} mt-2.5 opacity-60`}><svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>Continue with Phone<span className="ml-auto text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">soon</span></button>
              <button onClick={()=>setMode(mode==="signin"?"signup":"signin")} className="mt-5 w-full text-xs text-muted-foreground hover:text-foreground transition-colors">{mode==="signin"?"No account? Sign up":"Have an account? Sign in"}</button>
            </motion.div>)}
            {flow==="email"&&(<motion.div key="email" initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:16}} transition={{duration:0.22}}>
              <button onClick={()=>setFlow("main")} className="text-xs text-muted-foreground hover:text-foreground mb-5 inline-flex items-center gap-1">← Back</button>
              <h1 className="font-display text-2xl font-bold tracking-tight">{mode==="signin"?"Sign in with email":"Create account"}</h1>
              <form onSubmit={submitEmail} className="space-y-3 mt-6"><input type="email" required autoFocus value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className={inputCls}/><input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className={inputCls}/><button type="submit" disabled={!!busy} className={btnPrimary}>{busy==="email"?<Spinner light/>:mode==="signin"?"Sign in →":"Create account →"}</button></form>
              <button onClick={()=>setMode(mode==="signin"?"signup":"signin")} className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground">{mode==="signin"?"No account? Sign up":"Have an account? Sign in"}</button>
            </motion.div>)}
          </AnimatePresence>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">By continuing you agree to our <span className="underline cursor-pointer">Terms</span> & <span className="underline cursor-pointer">Privacy Policy</span></p>
      </div>
    </div>
  );
}
