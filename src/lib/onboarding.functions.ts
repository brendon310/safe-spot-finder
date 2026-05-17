import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { createLovableAiModel } from "@/lib/ai-gateway";

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
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured");
    const { text } = await generateText({
      model: createLovableAiModel(key),
      maxOutputTokens: 512,
      system: "You are a wise, warm, deeply human life coach. The user just answered the question: 'What is the one thing that, if you changed it, would change everything?'. Write a SHORT personal response of exactly 3 to 4 sentences that: (1) acknowledges what they wrote specifically, in their own words, (2) names the underlying desire behind it, (3) tells them — clearly and without hedging — that this journey is possible. End with EXACTLY this sentence as the final line: I'll be with you every step of the way. No greetings. No preamble. No quotes. No emojis. No markdown. Plain text only.",
      prompt: data.answer,
    });
    const message: string = text.trim();
    return { message };
  });