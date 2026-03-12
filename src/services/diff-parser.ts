import { minimatch } from "minimatch";
import type { DiffChunk, PullFile, ReviewConfig } from "../types/index.js";

const MAX_FILES = 30;
const MAX_PATCH_LENGTH = 8000;

const SKIP_PATTERNS: string[] = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "*.lock",
  "*.min.js",
  "*.min.css",
  "*.map",
  "*.png",
  "*.jpg",
  "*.jpeg",
  "*.gif",
  "*.svg",
  "*.ico",
  "*.woff",
  "*.woff2",
  "*.ttf",
  "*.eot",
  "*.mp4",
  "*.webm",
  "*.pdf",
  "*.zip",
  "*.tar.gz",
  "*.generated.*",
  "dist/**",
  "build/**",
  "__snapshots__/**",
];

export function filterFiles(files: PullFile[], config: ReviewConfig): PullFile[] {
  const allPatterns = [...SKIP_PATTERNS, ...config.ignore];

  let filtered = files.filter((file) => {
    if (file.status === "removed") return false;
    if (!file.patch) return false;
    return !allPatterns.some((pattern) => minimatch(file.filename, pattern, { matchBase: true }));
  });

  if (filtered.length > 50) {
    filtered.sort((a, b) => b.changes - a.changes);
    filtered = filtered.slice(0, MAX_FILES);
  }

  return filtered;
}

export function parseDiffs(files: PullFile[]): DiffChunk[] {
  return files.map((file) => ({
    filename: file.filename,
    patch: file.patch && file.patch.length > MAX_PATCH_LENGTH
      ? file.patch.slice(0, MAX_PATCH_LENGTH) + "\n... (truncated)"
      : file.patch ?? "",
    additions: file.additions,
    deletions: file.deletions,
    status: file.status,
  }));
}
