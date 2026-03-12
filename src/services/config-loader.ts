import yaml from "js-yaml";
import type { Context } from "probot";
import { DEFAULT_CONFIG, type ReviewConfig, type Strictness } from "../types/index.js";

const VALID_STRICTNESS: Set<string> = new Set(["low", "moderate", "strict"]);

export async function loadConfig(context: Context<"pull_request">): Promise<ReviewConfig> {
  try {
    const { owner, repo } = context.repo();
    const response = await context.octokit.rest.repos.getContent({
      owner,
      repo,
      path: ".pr-reviewer.yml",
    });

    if (!("content" in response.data)) {
      return { ...DEFAULT_CONFIG };
    }

    const content = Buffer.from(response.data.content, "base64").toString("utf-8");
    const parsed = yaml.load(content) as Record<string, unknown> | null;

    if (!parsed || typeof parsed !== "object") {
      context.log.warn("Invalid .pr-reviewer.yml — using defaults");
      return { ...DEFAULT_CONFIG };
    }

    return mergeConfig(parsed);
  } catch (error: unknown) {
    if (isHttpError(error) && error.status === 404) {
      return { ...DEFAULT_CONFIG };
    }
    context.log.warn("Failed to load .pr-reviewer.yml — using defaults");
    return { ...DEFAULT_CONFIG };
  }
}

function mergeConfig(parsed: Record<string, unknown>): ReviewConfig {
  const config = { ...DEFAULT_CONFIG };

  if (typeof parsed.strictness === "string" && VALID_STRICTNESS.has(parsed.strictness)) {
    config.strictness = parsed.strictness as Strictness;
  }

  if (Array.isArray(parsed.ignore)) {
    config.ignore = parsed.ignore.filter((item): item is string => typeof item === "string");
  }

  const maxComments = parsed.max_comments ?? parsed.maxComments;
  if (typeof maxComments === "number" && maxComments > 0) {
    config.maxComments = Math.floor(maxComments);
  }

  return config;
}

function isHttpError(error: unknown): error is { status: number } {
  return typeof error === "object" && error !== null && "status" in error;
}
