import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { anthropicText } from "@/lib/anthropic";
import { getWebRequest } from "@tanstack/react-start/server";

// Simple in-memory throttle (per worker instance) to limit abuse on this
// public endpoint. Not a hard guarantee across distributed workers, but
// adds meaningful friction against scripted spamming of the AI key.
const lastCallByIp = new Map<string, number>();
const MIN_GAP_MS = 4000;

function clientIp(): string {
  try {
    const req = getWebRequest();
    const h = req?.headers;
    return (
      h?.get("cf-connecting-ip") ||
      h?.get("x-forwarded-for")?.split(",")[0].trim() ||
      h?.get("x-real-ip") ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
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
    if (now - last < MIN_GAP_MS) {
      throw new Error("Too many requests — slow down a moment.");
    }
    lastCallByIp.set(ip, now);
    // Best-effort cleanup so the map doesn't grow forever.
    if (lastCallByIp.size > 5000) {
      for (const [k, t] of lastCallByIp) if (now - t > 60_000) lastCallByIp.delete(k);
    }

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const text = await anthropicText(
      key,
      "You are a wise, warm, deeply human life coach. The user just answered the question: 'What is the one thing that, if you changed it, would change everything?'. Write a SHORT personal response of exactly 3 to 4 sentences that: (1) acknowledges what they wrote specifically, in their own words, (2) names the underlying desire behind it, (3) tells them — clearly and without hedging — that this journey is possible. End with EXACTLY this sentence as the final line: I'll be with you every step of the way. No greetings. No preamble. No quotes. No emojis. No markdown. Plain text only.",
      [{ role: "user", content: data.answer }],
      "claude-haiku-4-5",
      512,
    );
    return { message: text.trim() };
  });