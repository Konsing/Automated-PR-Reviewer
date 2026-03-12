import { describe, it, expect } from "vitest";
import { buildReviewComments } from "../src/services/review-builder.js";
import type { DiffChunk, LLMReviewComment, ReviewConfig } from "../src/types/index.js";
import {
  singleHunkChunk,
  multiHunkChunk,
  sampleDiffChunks,
  bugComment,
  securityComment,
  performanceComment,
  suggestionComment,
  styleComment,
  unknownFileComment,
  outOfRangeComment,
  defaultConfig,
  lowMaxCommentsConfig,
} from "./fixtures/index.js";

// ---------------------------------------------------------------------------
// Position mapping
// ---------------------------------------------------------------------------

describe("buildReviewComments — position mapping", () => {
  it("maps single-hunk line numbers to correct 1-based positions", () => {
    // singleHunkChunk patch (positions counted manually):
    //
    // pos 1: @@ -10,6 +10,9 @@ export function greet(name: string): string {
    // pos 2:    const prefix = getPrefix();          (context, line 10)
    // pos 3: -  return prefix + name;                (deletion, no new line)
    // pos 4: +  if (!name) {                         (addition, line 11)
    // pos 5: +    throw new Error('name is required');(addition, line 12)
    // pos 6: +  }                                    (addition, line 13)
    // pos 7: +  return `${prefix} ${name}`;          (addition, line 14 — wait, 15? let me recount)
    //
    // After hunk header: currentLine = 10
    // pos 2: context line => currentLine 10 -> pos 2, then currentLine=11
    // pos 3: deletion => no currentLine advance
    // pos 4: addition => currentLine 11 -> pos 4, then currentLine=12
    // pos 5: addition => currentLine 12 -> pos 5, then currentLine=13
    // pos 6: addition => currentLine 13 -> pos 6, then currentLine=14
    // pos 7: addition => currentLine 14 -> pos 7, then currentLine=15
    // pos 8: context "}" => currentLine 15 -> pos 8, then currentLine=16
    // pos 9: context " " => currentLine 16 -> pos 9
    // pos 10: context "export function..." => currentLine 17 -> pos 10

    const comment: LLMReviewComment = {
      file: "src/utils/helpers.ts",
      line: 12, // should map to position 5
      comment: "Test comment",
      severity: "bug",
    };

    const result = buildReviewComments([comment], [singleHunkChunk], defaultConfig);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].position).toBe(5);
  });

  it("maps multi-hunk line numbers correctly — second hunk", () => {
    // multiHunkChunk:
    // Hunk 1: @@ -5,4 +5,5 @@
    //   pos 1: hunk header (currentLine=5)
    //   pos 2: context " const BASE_URL..." (line 5) -> currentLine=6
    //   pos 3: context " " (line 6) -> currentLine=7
    //   pos 4: deletion "-export async..." -> no advance
    //   pos 5: addition "+export async function fetchData(token: string) {" (line 7) -> currentLine=8
    //   pos 6: addition "+  axios.defaults..." (line 8) -> currentLine=9
    //   pos 7: context "  return axios..." (line 9) -> currentLine=10
    //
    // Hunk 2: @@ -20,3 +21,4 @@
    //   pos 8: hunk header (currentLine=21)
    //   pos 9: context "  if (!data)..." (line 21) -> currentLine=22
    //   pos 10: deletion "-  return JSON.parse..." -> no advance
    //   pos 11: addition "+  const parsed = JSON.parse..." (line 22) -> currentLine=23
    //   pos 12: addition "+  return sanitize(parsed);" (line 23) -> currentLine=24
    //   pos 13: context " }" (line 24) -> currentLine=25

    // securityComment targets line 8 in src/services/api.ts => position 6
    const result = buildReviewComments([securityComment], [multiHunkChunk], defaultConfig);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].position).toBe(6);

    // performanceComment targets line 23 in src/services/api.ts => position 12
    const result2 = buildReviewComments([performanceComment], [multiHunkChunk], defaultConfig);
    expect(result2.comments).toHaveLength(1);
    expect(result2.comments[0].position).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Severity badges
// ---------------------------------------------------------------------------

describe("buildReviewComments — severity badges", () => {
  it("applies the bug badge correctly", () => {
    const result = buildReviewComments([bugComment], [singleHunkChunk], defaultConfig);
    expect(result.comments[0].body).toContain("\u{1F534} **Bug:**");
  });

  it("applies the security badge correctly", () => {
    const result = buildReviewComments([securityComment], [multiHunkChunk], defaultConfig);
    expect(result.comments[0].body).toContain("\u{1F512} **Security:**");
  });

  it("applies the performance badge correctly", () => {
    const result = buildReviewComments([performanceComment], [multiHunkChunk], defaultConfig);
    expect(result.comments[0].body).toContain("\u26A1 **Performance:**");
  });

  it("applies the suggestion badge correctly", () => {
    const result = buildReviewComments([suggestionComment], [singleHunkChunk], defaultConfig);
    expect(result.comments[0].body).toContain("\u{1F7E1} **Suggestion:**");
  });

  it("applies the style badge correctly", () => {
    const result = buildReviewComments([styleComment], [singleHunkChunk], defaultConfig);
    expect(result.comments[0].body).toContain("\u{1F535} **Style:**");
  });
});

// ---------------------------------------------------------------------------
// Filtering & deduplication
// ---------------------------------------------------------------------------

describe("buildReviewComments — filtering", () => {
  it("drops comments with unknown filenames", () => {
    const result = buildReviewComments([unknownFileComment], sampleDiffChunks, defaultConfig);
    expect(result.comments).toHaveLength(0);
  });

  it("drops comments with out-of-range line numbers", () => {
    const result = buildReviewComments([outOfRangeComment], sampleDiffChunks, defaultConfig);
    expect(result.comments).toHaveLength(0);
  });

  it("deduplicates comments on the same file+position", () => {
    // Two different comments targeting the same line in the same file.
    const dup1: LLMReviewComment = {
      file: "src/utils/helpers.ts",
      line: 12,
      comment: "First comment",
      severity: "bug",
    };
    const dup2: LLMReviewComment = {
      file: "src/utils/helpers.ts",
      line: 12,
      comment: "Second comment on same line",
      severity: "suggestion",
    };

    const result = buildReviewComments([dup1, dup2], [singleHunkChunk], defaultConfig);
    expect(result.comments).toHaveLength(1);
    // The first one wins.
    expect(result.comments[0].body).toContain("First comment");
  });

  it("respects config.maxComments cap", () => {
    // lowMaxCommentsConfig has maxComments = 2
    const manyComments: LLMReviewComment[] = [
      bugComment,        // line 12 in helpers.ts
      suggestionComment, // line 13 in helpers.ts
      styleComment,      // line 14 in helpers.ts
      securityComment,   // line 8 in api.ts
      performanceComment,// line 23 in api.ts
    ];

    const result = buildReviewComments(manyComments, sampleDiffChunks, lowMaxCommentsConfig);
    expect(result.comments.length).toBeLessThanOrEqual(2);
    expect(result.comments).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

describe("buildReviewComments — categories", () => {
  it("returns correct categories Set from accepted comments", () => {
    const result = buildReviewComments(
      [bugComment, securityComment, performanceComment],
      sampleDiffChunks,
      defaultConfig,
    );

    expect(result.categories.has("bug")).toBe(true);
    expect(result.categories.has("security")).toBe(true);
    expect(result.categories.has("performance")).toBe(true);
    expect(result.categories.has("suggestion")).toBe(false);
    expect(result.categories.has("style")).toBe(false);
  });

  it("returns empty Set when no comments survive filtering", () => {
    const result = buildReviewComments(
      [unknownFileComment, outOfRangeComment],
      sampleDiffChunks,
      defaultConfig,
    );

    expect(result.categories.size).toBe(0);
    expect(result.comments).toHaveLength(0);
  });

  it("returns empty Set when input comments array is empty", () => {
    const result = buildReviewComments([], sampleDiffChunks, defaultConfig);
    expect(result.categories.size).toBe(0);
    expect(result.comments).toHaveLength(0);
  });
});
