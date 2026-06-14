import { chat, builderConfig, type ChatMessage } from "@cr/llm";
import { parse } from "@cr/codemod";
import type { SourceLocation } from "@cr/protocol";
import { readFile, writeFile } from "./fileApi.js";
import { extractJson } from "./interview.js";

export interface AiEditResult {
  ok: boolean;
  file?: string;
  error?: string;
  raw?: string;
}

const SYSTEM: ChatMessage = {
  role: "system",
  content: `You edit a single React Native source file based on a natural-language instruction.
You are given the full file and (optionally) the line the user tapped.
Return ONLY a JSON object: {"content": "<the FULL updated file>"}.
Rules:
- Make the smallest change that satisfies the instruction. Preserve everything else exactly.
- Keep all existing imports, including TapEditProvider, and keep StyleSheet usage.
- Output valid TypeScript TSX only. No markdown, no commentary.`,
};

/**
 * Apply a free-form instruction (e.g. "make the title bigger", "move this up")
 * to a file via the builder model. Used for changes beyond the deterministic
 * text/color codemod. Always re-validates before writing so the preview never
 * breaks.
 */
export async function aiEdit(input: {
  source: SourceLocation;
  instruction: string;
}): Promise<AiEditResult> {
  let original: string;
  try {
    original = await readFile(input.source.file);
  } catch (e: any) {
    return { ok: false, error: `Cannot read ${input.source.file}: ${e.message}` };
  }

  const user: ChatMessage = {
    role: "user",
    content: `Instruction: ${input.instruction}
Tapped at line ${input.source.line} (column ${input.source.col}).

FILE (${input.source.file}):
\`\`\`tsx
${original}
\`\`\``,
  };

  let raw: string;
  try {
    raw = await chat(builderConfig(), {
      messages: [SYSTEM, user],
      temperature: 0.3,
      maxTokens: 4000,
    });
  } catch (e: any) {
    return { ok: false, error: e.message };
  }

  const parsed = extractJson<{ content: string }>(raw);
  if (!parsed?.content || typeof parsed.content !== "string") {
    return { ok: false, error: "AI edit did not return content", raw };
  }

  try {
    parse(parsed.content);
  } catch (e: any) {
    return { ok: false, error: `AI edit produced invalid code: ${e.message}`, raw };
  }

  if (parsed.content !== original) {
    try {
      await writeFile(input.source.file, parsed.content);
    } catch (e: any) {
      return { ok: false, error: `Cannot write ${input.source.file}: ${e.message}` };
    }
  }
  return { ok: true, file: input.source.file };
}
