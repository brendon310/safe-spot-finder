import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const createLovableAiGatewayProvider = (lovableApiKey: string) =>
  createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

export const createLovableAiModel = (
  lovableApiKey: string,
  model = "google/gemini-3-flash-preview",
) => createLovableAiGatewayProvider(lovableApiKey)(model.startsWith("claude-") ? "google/gemini-3-flash-preview" : model);