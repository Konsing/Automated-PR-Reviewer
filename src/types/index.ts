export type Severity = "bug" | "security" | "performance" | "suggestion" | "style";

export type Category = Severity;

export type Strictness = "low" | "moderate" | "strict";

export interface ReviewConfig {
  strictness: Strictness;
  ignore: string[];
  maxComments: number;
}

export interface DiffChunk {
  filename: string;
  patch: string;
  additions: number;
  deletions: number;
  status: string;
}

export interface LLMReviewComment {
  file: string;
  line: number;
  comment: string;
  severity: Severity;
}

export interface LLMReviewResponse {
  comments: LLMReviewComment[];
}

export interface GitHubReviewComment {
  path: string;
  position: number;
  body: string;
}

export interface PullFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface ReviewResult {
  comments: GitHubReviewComment[];
  categories: Set<Category>;
}

export const DEFAULT_CONFIG: ReviewConfig = {
  strictness: "moderate",
  ignore: [],
  maxComments: 25,
};

export const SEVERITY_BADGES: Record<Severity, string> = {
  bug: "🔴 **Bug:**",
  security: "🔒 **Security:**",
  performance: "⚡ **Performance:**",
  suggestion: "🟡 **Suggestion:**",
  style: "🔵 **Style:**",
};

export const LABEL_MAP: Record<Category | "clean", { name: string; color: string }> = {
  bug: { name: "ai:bug-found", color: "d73a4a" },
  security: { name: "ai:security-concern", color: "e36209" },
  performance: { name: "ai:performance", color: "fbca04" },
  suggestion: { name: "ai:suggestion", color: "0075ca" },
  style: { name: "ai:style", color: "c5c5c5" },
  clean: { name: "ai:clean-review", color: "0e8a16" },
};
