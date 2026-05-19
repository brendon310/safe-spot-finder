import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getRequest } from "@tanstack/react-start/server";

const lastCallByIp = new Map<string, number>();
const MIN_GAP_MS = 4000;

function clientIp(): string {
  try {
    const req = getRequest();
    const h = req?.headers;
    return (h?.get("x-forwarded-for")?.split(",")[0].trim() || h?.get("x-real-ip") || "unknown");
  } catch { return "unknown"; }
}

async function anthropicText(key: string, system: string, messages: { role: "user" | "assistant"; content: string }[], model = "claude-haiku-4-5-20251001", maxTokens = 512): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) throw new Error(`AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return (j.content?.[0]?.text ?? "").trim();
}

export const getPublicCatalog = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("tracks_catalog")
      .select("id,slug,name,category,short_description,sort_order")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCoachResponse = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ answer: z.string().min(10).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const ip = clientIp();
    const now = Date.now();
    const last = lastCallByIp.get(ip) ?? 0;
    if (now - last < MIN_GAP_MS) throw new Error("Too many requests — slow down a moment.");
    lastCallByIp.set(ip, now);
    if (lastCallByIp.size > 5000) { for (const [k, t] of lastCallByIp) if (now - t > 60_000) lastCallByIp.delete(k); }

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("AI is not configured");

    const message = await anthropicText(
      key,
      "You are a wise, warm, deeply human life coach. The user just answered the question: 'What is the one thing that, if you changed it, would change everything?'. Write a SHORT personal response of exactly 3 to 4 sentences that: (1) acknowledges what they wrote specifically, in their own words, (2) names the underlying desire behind it, (3) tells them — clearly and without hedging — that this journey is possible. End with EXACTLY this sentence as the final line: I'll be with you every step of the way. No greetings. No preamble. No quotes. No emojis. No markdown. Plain text only.",
      [{ role: "user", content: data.answer }],
      "claude-haiku-4-5-20251001",
      512,
    );
    return { message };
  });
