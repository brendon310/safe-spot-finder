const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5";

type Msg = { role: "user" | "assistant"; content: string };

async function callAnthropic(
  key: string,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errTxt = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${errTxt.slice(0, 300)}`);
  }
  const json: any = await res.json();
  return json?.content?.[0]?.text ?? "";
}

export async function anthropicText(
  key: string,
  system: string,
  messages: Msg[],
  model: string = DEFAULT_MODEL,
  maxTokens = 1024,
): Promise<string> {
  return callAnthropic(key, {
    model,
    max_tokens: maxTokens,
    system,
    messages,
  });
}

export async function anthropicJSON(
  key: string,
  system: string,
  user: string,
  model: string = DEFAULT_MODEL,
  maxTokens = 1024,
): Promise<any> {
  const txt = await callAnthropic(key, {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const raw = (txt || "{}").trim();
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim());
  }
}