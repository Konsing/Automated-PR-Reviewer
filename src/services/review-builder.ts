import type {
  Category,
  DiffChunk,
  GitHubReviewComment,
  LLMReviewComment,
  ReviewConfig,
  ReviewResult,
  Severity,
} from "../types/index.js";
import { SEVERITY_BADGES } from "../types/index.js";

/**
 * Maps LLM line numbers to GitHub diff positions.
 *
 * A diff position is 1-based, counting every line in the patch
 * (context lines, additions, and deletions). Position does NOT
 * reset between hunks — it's continuous across the entire patch.
 */
function buildPositionMap(patch: string): Map<number, number> {
  const lineMap = new Map<number, number>();
  const lines = patch.split("\n");
  let position = 0;
  let currentLine = 0;

  for (const line of lines) {
    // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1], 10);
      position++;
      continue;
    }

    if (position === 0) continue; // Skip lines before first hunk header

    position++;

    if (line.startsWith("+")) {
      lineMap.set(currentLine, position);
      currentLine++;
    } else if (line.startsWith("-")) {
      // Deleted lines don't advance the new file line count
    } else {
      // Context line
      currentLine++;
    }
  }

  return lineMap;
}

export function buildReviewComments(
  llmComments: LLMReviewComment[],
  diffChunks: DiffChunk[],
  config: ReviewConfig,
): ReviewResult {
  const categories = new Set<Category>();
  const comments: GitHubReviewComment[] = [];
  const seen = new Set<string>();

  // Build position maps for all files
  const positionMaps = new Map<string, Map<number, number>>();
  for (const chunk of diffChunks) {
    positionMaps.set(chunk.filename, buildPositionMap(chunk.patch));
  }

  for (const comment of llmComments) {
    // Skip unknown files
    const posMap = positionMaps.get(comment.file);
    if (!posMap) continue;

    // Find position for line
    const position = posMap.get(comment.line);
    if (!position) continue;

    // Deduplicate same file+position
    const key = `${comment.file}:${position}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Track category
    categories.add(comment.severity as Category);

    const badge = SEVERITY_BADGES[comment.severity as Severity] ?? "💬";
    comments.push({
      path: comment.file,
      position,
      body: `${badge} ${comment.comment}`,
    });

    if (comments.length >= config.maxComments) break;
  }

  return { comments, categories };
}
