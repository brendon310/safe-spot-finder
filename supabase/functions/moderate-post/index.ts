// Edge function: moderate-post
// Calls Anthropic Claude to moderate community board posts.
// Returns { approved: boolean, reason?: string }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT =
  "You are a strict content moderator for a self-improvement community. The user is sharing a reflection about their personal growth journey. Reject any content that contains: sexual references, vulgar language, profanity, slurs, offensive content, spam, hateful speech, threats, harassment, content unrelated to personal growth or the specific track topic, or anything not suitable for a family-friendly environment. When in doubt, reject. Respond ONLY with valid JSON in this exact shape: {\"approved\": true|false, \"reason\": \"short reason if rejected\"}";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY is not set");
      return new Response(
        JSON.stringify({ error: "moderation_unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    const content = body?.content;
    const trackSlug = body?.trackSlug ?? "";
    if (typeof content !== "string" || content.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "invalid_input" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Track: ${trackSlug}\n\nPost: ${content}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Anthropic API error:", res.status, errText);
      return new Response(
        JSON.stringify({ error: "moderation_failed", status: res.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await res.json();
    const text: string = json?.content?.[0]?.text ?? "";
    let parsed: { approved?: boolean; reason?: string };
    try {
      // Strip code fences if model added any.
      const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse Claude response as JSON:", text);
      return new Response(
        JSON.stringify({ error: "moderation_parse_failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const approved = parsed.approved === true;
    return new Response(
      JSON.stringify({ approved, reason: parsed.reason ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("moderate-post unexpected error:", e);
    return new Response(
      JSON.stringify({ error: "moderation_unavailable" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});