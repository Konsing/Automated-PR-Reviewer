import Groq from "groq-sdk";
import type { DiffChunk, LLMReviewComment, LLMReviewResponse, ReviewConfig, Severity } from "../types/index.js";

const MODEL = "llama-3.3-70b-versatile";
const TEMPERATURE = 0.1;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const CHUNK_DELAY_MS = 2000;

const VALID_SEVERITIES: Set<string> = new Set(["bug", "security", "performance", "suggestion", "style"]);

const STRICTNESS_INSTRUCTIONS: Record<string, string> = {
  low: "Only flag critical bugs and security issues. Ignore style and minor suggestions.",
  moderate: "Flag bugs, security issues, and significant performance or logic suggestions. Skip trivial style issues.",
  strict: "Thoroughly review for bugs, security, performance, style, and best practices. Be comprehensive.",
};

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function buildSystemPrompt(config: ReviewConfig): string {
  return `You are an expert senior code reviewer. Review the provided code diff and return actionable, specific review comments.

Rules:
- ${STRICTNESS_INSTRUCTIONS[config.strictness]}
- Only comment on added or modified lines (lines starting with +).
- Reference the exact line number from the diff.
- Each comment must be concise and actionable.
- Do NOT comment on removed lines, imports-only changes, or trivial formatting.

Return your response as JSON in this exact format:
{
  "comments": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "comment": "Description of the issue and how to fix it.",
      "severity": "bug"
    }
  ]
}

Severity must be one of: "bug", "security", "performance", "suggestion", "style".
If there are no issues, return: { "comments": [] }`;
}

function buildUserPrompt(chunks: DiffChunk[]): string {
  const diffs = chunks
    .map((chunk) => `### ${chunk.filename}\n\`\`\`diff\n${chunk.patch}\n\`\`\``)
    .join("\n\n");

  return `Review the following code changes:\n\n${diffs}`;
}

function validateComment(comment: unknown): comment is LLMReviewComment {
  if (!comment || typeof comment !== "object") return false;
  const c = comment as Record<string, unknown>;
  return (
    typeof c.file === "string" &&
    typeof c.line === "number" &&
    typeof c.comment === "string" &&
    typeof c.severity === "string" &&
    VALID_SEVERITIES.has(c.severity)
  );
}

function parseResponse(raw: string): LLMReviewComment[] {
  try {
    const parsed = JSON.parse(raw) as LLMReviewResponse;
    if (!parsed || !Array.isArray(parsed.comments)) return [];
    return parsed.comments.filter(validateComment);
  } catch {
    return [];
  }
}

async function callWithRetry(
  systemPrompt: string,
  userPrompt: string,
  logger: { info: (msg: string) => void; warn: (msg: string) => void },
): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await groq.chat.completions.create({
        model: MODEL,
        temperature: TEMPERATURE,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      return response.choices[0]?.message?.content ?? "{}";
    } catch (error: unknown) {
      if (isRateLimitError(error) && attempt < MAX_RETRIES - 1) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        logger.warn(`Rate limited. Retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(backoff);
        continue;
      }
      throw error;
    }
  }

  return "{}";
}

export async function reviewDiffs(
  chunks: DiffChunk[],
  config: ReviewConfig,
  logger: { info: (msg: string) => void; warn: (msg: string) => void },
): Promise<LLMReviewComment[]> {
  if (chunks.length === 0) return [];

  const systemPrompt = buildSystemPrompt(config);
  const allComments: LLMReviewComment[] = [];

  // Process chunks in batches to stay within token limits
  const batches = batchChunks(chunks, 6000);

  for (let i = 0; i < batches.length; i++) {
    if (i > 0) {
      await sleep(CHUNK_DELAY_MS);
    }

    const userPrompt = buildUserPrompt(batches[i]);
    logger.info(`Reviewing batch ${i + 1}/${batches.length} (${batches[i].length} files)`);

    try {
      const raw = await callWithRetry(systemPrompt, userPrompt, logger);
      const comments = parseResponse(raw);
      allComments.push(...comments);
    } catch (error) {
      logger.warn(`Failed to review batch ${i + 1}: ${error}`);
    }
  }

  return allComments;
}

function batchChunks(chunks: DiffChunk[], maxCharsPerBatch: number): DiffChunk[][] {
  const batches: DiffChunk[][] = [];
  let currentBatch: DiffChunk[] = [];
  let currentSize = 0;

  for (const chunk of chunks) {
    const chunkSize = chunk.patch.length;

    if (currentBatch.length > 0 && currentSize + chunkSize > maxCharsPerBatch) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }

    currentBatch.push(chunk);
    currentSize += chunkSize;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === 429
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
