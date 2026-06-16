// Runtime AI for generated apps — vision/text via DeepInfra Qwen3-VL (visionConfig).
import { chat, visionConfig, type ChatMessage, type ContentPart } from "@cr/llm";

/**
 * Runtime AI for generated apps: answer a text prompt, optionally about an image
 * (data URL). Backs POST /api/ai. Vision-capable model via visionConfig().
 */
export async function runAI(input: {
  prompt: string;
  imageDataUrl?: string;
}): Promise<{ ok: boolean; answer?: string; error?: string }> {
  const prompt = (input.prompt || "").trim();
  if (!prompt) return { ok: false, error: "prompt required" };

  const content: string | ContentPart[] = input.imageDataUrl
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: input.imageDataUrl } },
      ]
    : prompt;

  const messages: ChatMessage[] = [{ role: "user", content }];
  try {
    const answer = await chat(visionConfig(), {
      messages,
      temperature: 0.3,
      maxTokens: 1024,
    });
    return { ok: true, answer: answer.trim() };
  } catch (e: any) {
    return { ok: false, error: e?.message || "AI request failed" };
  }
}
