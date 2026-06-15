import { chat, builderConfig, type ChatMessage } from "@cr/llm";
import { parse } from "@cr/codemod";
import type { SourceLocation } from "@cr/protocol";
import { readFile, writeFile } from "./fileApi.js";
import { extractJson } from "./interview.js";
import { IOS_FEEL_PROMPT } from "./iosFeel.js";
import { record } from "./history.js";

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
- Keep all existing imports and kit usage; keep StyleSheet usage.
- Output valid TypeScript TSX only. No markdown, no commentary.
- Stay premium-iOS and tap-to-edit-friendly per the rules below.

${IOS_FEEL_PROMPT}`,
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

  // Like the builder, the model can intermittently return empty/truncated output
  // (reasoning eats the budget). Retry the generate+validate a couple times; only
  // write once we have a valid, fully-parsed file.
  const MAX_ATTEMPTS = 3;
  let lastError = "";
  let lastRaw = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let raw: string;
    try {
      raw = await chat(builderConfig(), {
        messages: [SYSTEM, user],
        temperature: 0.3,
        maxTokens: 30000,
      });
    } catch (e: any) {
      lastError = e.message; // empty content / network blip — retry
      continue;
    }
    lastRaw = raw;

    const parsed = extractJson<{ content: string }>(raw);
    if (!parsed?.content || typeof parsed.content !== "string") {
      lastError = "AI edit did not return content"; // truncated/empty — retry
      continue;
    }

    try {
      parse(parsed.content);
    } catch (e: any) {
      lastError = `AI edit produced invalid code: ${e.message}`; // bad gen — retry
      continue;
    }

    if (parsed.content !== original) {
      try {
        await writeFile(input.source.file, parsed.content);
      } catch (e: any) {
        // Filesystem error isn't the model's fault — don't retry.
        return { ok: false, error: `Cannot write ${input.source.file}: ${e.message}` };
      }
      // Snapshot for the undo/redo timeline.
      record({
        file: input.source.file,
        before: original,
        after: parsed.content,
        label: `AI: ${input.instruction.slice(0, 40)} · ${input.source.file}`,
      });
    }
    return { ok: true, file: input.source.file };
  }

  return { ok: false, error: lastError || "AI edit failed", raw: lastRaw };
}
