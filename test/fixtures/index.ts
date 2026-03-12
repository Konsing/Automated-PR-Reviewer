import type {
  DiffChunk,
  LLMReviewComment,
  PullFile,
  ReviewConfig,
} from "../../src/types/index.js";

// ---------------------------------------------------------------------------
// PullFile fixtures
// ---------------------------------------------------------------------------

/** A normal TypeScript source file with a simple patch. */
export const normalTsFile: PullFile = {
  filename: "src/utils/helpers.ts",
  status: "modified",
  additions: 5,
  deletions: 2,
  changes: 7,
  patch:
    "@@ -10,6 +10,9 @@ export function greet(name: string): string {\n" +
    "   const prefix = getPrefix();\n" +
    "-  return prefix + name;\n" +
    "+  if (!name) {\n" +
    "+    throw new Error('name is required');\n" +
    "+  }\n" +
    "+  return `${prefix} ${name}`;\n" +
    " }\n" +
    " \n" +
    " export function getPrefix(): string {",
};

/** A second normal source file. */
export const normalJsFile: PullFile = {
  filename: "src/index.js",
  status: "added",
  additions: 10,
  deletions: 0,
  changes: 10,
  patch:
    "@@ -0,0 +1,10 @@\n" +
    "+import { greet } from './utils/helpers.js';\n" +
    "+\n" +
    "+console.log(greet('world'));\n",
};

/** package-lock.json — should be skipped. */
export const lockFile: PullFile = {
  filename: "package-lock.json",
  status: "modified",
  additions: 500,
  deletions: 300,
  changes: 800,
  patch: "@@ -1,5 +1,5 @@\n-old\n+new\n",
};

/** yarn.lock — should be skipped. */
export const yarnLockFile: PullFile = {
  filename: "yarn.lock",
  status: "modified",
  additions: 100,
  deletions: 80,
  changes: 180,
  patch: "@@ -1,3 +1,3 @@\n-old\n+new\n",
};

/** A PNG image — should be skipped. */
export const imageFile: PullFile = {
  filename: "assets/logo.png",
  status: "added",
  additions: 0,
  deletions: 0,
  changes: 0,
  patch: undefined,
};

/** A removed file — should be skipped. */
export const removedFile: PullFile = {
  filename: "src/old-module.ts",
  status: "removed",
  additions: 0,
  deletions: 45,
  changes: 45,
  patch: "@@ -1,45 +0,0 @@\n-// entire file removed\n",
};

/** A binary file with no patch — should be skipped. */
export const binaryFile: PullFile = {
  filename: "dist/bundle.min.js",
  status: "modified",
  additions: 0,
  deletions: 0,
  changes: 0,
  patch: undefined,
};

/** A docs markdown file — used for testing custom ignore patterns. */
export const docsFile: PullFile = {
  filename: "docs/getting-started.md",
  status: "modified",
  additions: 3,
  deletions: 1,
  changes: 4,
  patch: "@@ -1,4 +1,6 @@\n # Getting Started\n-Old intro.\n+New intro.\n+\n+More details.\n",
};

/** A test file — used for testing custom ignore patterns. */
export const testFile: PullFile = {
  filename: "src/utils/helpers.test.ts",
  status: "modified",
  additions: 8,
  deletions: 2,
  changes: 10,
  patch:
    "@@ -5,4 +5,10 @@ describe('helpers', () => {\n" +
    "   it('greets', () => {\n" +
    "-    expect(greet('world')).toBe('Hello world');\n" +
    "+    expect(greet('world')).toBe('Hello world');\n" +
    "+  });\n" +
    "+\n" +
    "+  it('throws on empty name', () => {\n" +
    "+    expect(() => greet('')).toThrow();\n" +
    "   });\n" +
    " });\n",
};

/** A collection of all sample files. */
export const samplePullFiles: PullFile[] = [
  normalTsFile,
  normalJsFile,
  lockFile,
  yarnLockFile,
  imageFile,
  removedFile,
  binaryFile,
  docsFile,
  testFile,
];

// ---------------------------------------------------------------------------
// DiffChunk fixtures
// ---------------------------------------------------------------------------

/** A single-hunk diff chunk for a TypeScript file. */
export const singleHunkChunk: DiffChunk = {
  filename: "src/utils/helpers.ts",
  patch:
    "@@ -10,6 +10,9 @@ export function greet(name: string): string {\n" +
    "   const prefix = getPrefix();\n" +
    "-  return prefix + name;\n" +
    "+  if (!name) {\n" +
    "+    throw new Error('name is required');\n" +
    "+  }\n" +
    "+  return `${prefix} ${name}`;\n" +
    " }\n" +
    " \n" +
    " export function getPrefix(): string {",
  additions: 5,
  deletions: 2,
  status: "modified",
};

/**
 * A multi-hunk diff chunk. Two hunks in one patch.
 *
 * Hunk 1: lines 5-9 in new file  (positions 1..5 in the patch)
 * Hunk 2: lines 20-24 in new file (positions 6..11 in the patch)
 */
export const multiHunkChunk: DiffChunk = {
  filename: "src/services/api.ts",
  patch:
    "@@ -5,4 +5,5 @@ import axios from 'axios';\n" +
    " const BASE_URL = 'https://api.example.com';\n" +
    " \n" +
    "-export async function fetchData() {\n" +
    "+export async function fetchData(token: string) {\n" +
    "+  axios.defaults.headers.common['Authorization'] = `Bearer ${'{token}'}`;\n" +
    "   return axios.get(BASE_URL);\n" +
    "@@ -20,3 +21,4 @@ export function parseResponse(data: unknown) {\n" +
    "   if (!data) return null;\n" +
    "-  return JSON.parse(data as string);\n" +
    "+  const parsed = JSON.parse(data as string);\n" +
    "+  return sanitize(parsed);\n" +
    " }\n",
  additions: 4,
  deletions: 2,
  status: "modified",
};

/** Sample diff chunks array. */
export const sampleDiffChunks: DiffChunk[] = [singleHunkChunk, multiHunkChunk];

// ---------------------------------------------------------------------------
// LLMReviewComment fixtures
// ---------------------------------------------------------------------------

export const bugComment: LLMReviewComment = {
  file: "src/utils/helpers.ts",
  line: 12,
  comment: "Throwing inside a hot path may degrade performance.",
  severity: "bug",
};

export const securityComment: LLMReviewComment = {
  file: "src/services/api.ts",
  line: 8,
  comment: "Token is interpolated directly — ensure it's sanitized.",
  severity: "security",
};

export const performanceComment: LLMReviewComment = {
  file: "src/services/api.ts",
  line: 23,
  comment: "JSON.parse on unvalidated input can be slow for large payloads.",
  severity: "performance",
};

export const suggestionComment: LLMReviewComment = {
  file: "src/utils/helpers.ts",
  line: 13,
  comment: "Consider using a custom error class for better error handling.",
  severity: "suggestion",
};

export const styleComment: LLMReviewComment = {
  file: "src/utils/helpers.ts",
  line: 14,
  comment: "Use consistent string interpolation style.",
  severity: "style",
};

/** Comment referencing a file not in the diff — should be dropped. */
export const unknownFileComment: LLMReviewComment = {
  file: "src/nonexistent.ts",
  line: 5,
  comment: "This file doesn't exist in the diff.",
  severity: "suggestion",
};

/** Comment with a line number that doesn't map to any diff position. */
export const outOfRangeComment: LLMReviewComment = {
  file: "src/utils/helpers.ts",
  line: 999,
  comment: "This line is way out of range.",
  severity: "bug",
};

/** All sample LLM comments. */
export const sampleLLMComments: LLMReviewComment[] = [
  bugComment,
  securityComment,
  performanceComment,
  suggestionComment,
  styleComment,
];

// ---------------------------------------------------------------------------
// ReviewConfig fixtures
// ---------------------------------------------------------------------------

export const defaultConfig: ReviewConfig = {
  strictness: "moderate",
  ignore: [],
  maxComments: 25,
};

export const strictConfig: ReviewConfig = {
  strictness: "strict",
  ignore: [],
  maxComments: 50,
};

export const configWithIgnorePatterns: ReviewConfig = {
  strictness: "moderate",
  ignore: ["docs/**", "*.test.ts"],
  maxComments: 25,
};

export const lowMaxCommentsConfig: ReviewConfig = {
  strictness: "low",
  ignore: [],
  maxComments: 2,
};

// ---------------------------------------------------------------------------
// YAML config content
// ---------------------------------------------------------------------------

export const sampleYamlContent = `\
strictness: strict
ignore:
  - "docs/**"
  - "*.test.ts"
max_comments: 15
`;

export const partialYamlContent = `\
strictness: strict
`;

export const invalidYamlContent = `\
: : [invalid yaml
  - not: [properly
`;

export const yamlWithMaxCommentsAlias = `\
maxComments: 30
`;

export const yamlWithUnknownStrictness = `\
strictness: ultra
max_comments: 10
`;

// ---------------------------------------------------------------------------
// Helpers for generating large file sets
// ---------------------------------------------------------------------------

/**
 * Creates N dummy PullFile objects with patches and varying change counts.
 * Useful for testing the 50-file cap/sort logic.
 */
export function createManyFiles(count: number): PullFile[] {
  return Array.from({ length: count }, (_, i) => ({
    filename: `src/file-${String(i).padStart(3, "0")}.ts`,
    status: "modified",
    additions: count - i,
    deletions: i,
    changes: count - i + i, // always equals count, so we vary it below
    patch: `@@ -1,3 +1,3 @@\n context\n-old ${i}\n+new ${i}\n`,
  }));
}

/**
 * Like createManyFiles but each file has a unique `changes` value
 * so sorting by changes descending is deterministic.
 */
export function createManyFilesWithUniqueChanges(count: number): PullFile[] {
  return Array.from({ length: count }, (_, i) => ({
    filename: `src/file-${String(i).padStart(3, "0")}.ts`,
    status: "modified",
    additions: count - i,
    deletions: 0,
    changes: count - i, // unique, descending from count to 1
    patch: `@@ -1,3 +1,3 @@\n context\n-old ${i}\n+new ${i}\n`,
  }));
}
