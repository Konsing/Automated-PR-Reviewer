import { describe, it, expect, vi } from "vitest";
import { loadConfig } from "../src/services/config-loader.js";
import { DEFAULT_CONFIG } from "../src/types/index.js";
import {
  sampleYamlContent,
  partialYamlContent,
  invalidYamlContent,
  yamlWithMaxCommentsAlias,
  yamlWithUnknownStrictness,
} from "./fixtures/index.js";

// ---------------------------------------------------------------------------
// Helper: create a mock Probot context
// ---------------------------------------------------------------------------

function createMockContext(overrides: {
  getContentResponse?: any;
  getContentError?: any;
}) {
  return {
    repo: () => ({ owner: "test-owner", repo: "test-repo" }),
    log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    octokit: {
      rest: {
        repos: {
          getContent: overrides.getContentError
            ? vi.fn().mockRejectedValue(overrides.getContentError)
            : vi.fn().mockResolvedValue({ data: overrides.getContentResponse }),
        },
      },
    },
  } as any;
}

/**
 * Encodes a UTF-8 string to base64, mimicking what the GitHub API returns
 * for file contents.
 */
function toBase64(content: string): string {
  return Buffer.from(content, "utf-8").toString("base64");
}

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

describe("loadConfig", () => {
  it("returns defaults when .pr-reviewer.yml does not exist (404)", async () => {
    const ctx = createMockContext({
      getContentError: { status: 404, message: "Not Found" },
    });

    const config = await loadConfig(ctx);
    expect(config).toEqual({ ...DEFAULT_CONFIG });
  });

  it("returns defaults on non-404 errors and logs a warning", async () => {
    const ctx = createMockContext({
      getContentError: { status: 500, message: "Internal Server Error" },
    });

    const config = await loadConfig(ctx);
    expect(config).toEqual({ ...DEFAULT_CONFIG });
    expect(ctx.log.warn).toHaveBeenCalledWith(
      "Failed to load .pr-reviewer.yml — using defaults",
    );
  });

  it("parses valid YAML correctly", async () => {
    const ctx = createMockContext({
      getContentResponse: {
        content: toBase64(sampleYamlContent),
      },
    });

    const config = await loadConfig(ctx);
    expect(config.strictness).toBe("strict");
    expect(config.ignore).toEqual(["docs/**", "*.test.ts"]);
    expect(config.maxComments).toBe(15);
  });

  it("handles invalid YAML gracefully and returns defaults", async () => {
    const ctx = createMockContext({
      getContentResponse: {
        content: toBase64(invalidYamlContent),
      },
    });

    const config = await loadConfig(ctx);
    // Invalid YAML might parse as something unexpected or throw; either way
    // the function should return defaults (or a safe merge).
    // The actual code checks `if (!parsed || typeof parsed !== 'object')`.
    // js-yaml may throw on truly broken YAML, which is caught by the try/catch.
    expect(config.strictness).toBe(DEFAULT_CONFIG.strictness);
    expect(config.maxComments).toBe(DEFAULT_CONFIG.maxComments);
  });

  it("merges partial config with defaults (only strictness set)", async () => {
    const ctx = createMockContext({
      getContentResponse: {
        content: toBase64(partialYamlContent),
      },
    });

    const config = await loadConfig(ctx);
    expect(config.strictness).toBe("strict");
    // Other fields should fall back to defaults.
    expect(config.ignore).toEqual(DEFAULT_CONFIG.ignore);
    expect(config.maxComments).toBe(DEFAULT_CONFIG.maxComments);
  });

  it("handles unknown strictness values by keeping default", async () => {
    const ctx = createMockContext({
      getContentResponse: {
        content: toBase64(yamlWithUnknownStrictness),
      },
    });

    const config = await loadConfig(ctx);
    // "ultra" is not a valid strictness, so it should stay "moderate".
    expect(config.strictness).toBe(DEFAULT_CONFIG.strictness);
    // max_comments: 10 should still be applied.
    expect(config.maxComments).toBe(10);
  });

  it("supports the max_comments YAML field name", async () => {
    const ctx = createMockContext({
      getContentResponse: {
        content: toBase64(sampleYamlContent), // uses max_comments: 15
      },
    });

    const config = await loadConfig(ctx);
    expect(config.maxComments).toBe(15);
  });

  it("supports the maxComments YAML field name", async () => {
    const ctx = createMockContext({
      getContentResponse: {
        content: toBase64(yamlWithMaxCommentsAlias), // uses maxComments: 30
      },
    });

    const config = await loadConfig(ctx);
    expect(config.maxComments).toBe(30);
  });

  it("returns defaults when response data has no 'content' field", async () => {
    // This can happen if the API returns a directory listing instead of a file.
    const ctx = createMockContext({
      getContentResponse: [
        { name: ".pr-reviewer.yml", type: "file" },
      ],
    });

    const config = await loadConfig(ctx);
    expect(config).toEqual({ ...DEFAULT_CONFIG });
  });

  it("returns defaults when YAML content parses to null", async () => {
    const ctx = createMockContext({
      getContentResponse: {
        content: toBase64(""),
      },
    });

    const config = await loadConfig(ctx);
    // yaml.load("") returns undefined, which is falsy.
    expect(config).toEqual({ ...DEFAULT_CONFIG });
  });

  it("returns defaults when YAML content is a scalar (not an object)", async () => {
    const ctx = createMockContext({
      getContentResponse: {
        content: toBase64("just a string"),
      },
    });

    const config = await loadConfig(ctx);
    expect(config).toEqual({ ...DEFAULT_CONFIG });
  });

  it("filters out non-string entries in the ignore array", async () => {
    const yamlWithMixedIgnore = `\
ignore:
  - "docs/**"
  - 42
  - true
  - "*.test.ts"
`;
    const ctx = createMockContext({
      getContentResponse: {
        content: toBase64(yamlWithMixedIgnore),
      },
    });

    const config = await loadConfig(ctx);
    expect(config.ignore).toEqual(["docs/**", "*.test.ts"]);
  });

  it("floors fractional maxComments values", async () => {
    const yamlWithFraction = `\
max_comments: 10.7
`;
    const ctx = createMockContext({
      getContentResponse: {
        content: toBase64(yamlWithFraction),
      },
    });

    const config = await loadConfig(ctx);
    expect(config.maxComments).toBe(10);
  });

  it("ignores non-positive maxComments values", async () => {
    const yamlWithZero = `\
max_comments: 0
`;
    const ctx = createMockContext({
      getContentResponse: {
        content: toBase64(yamlWithZero),
      },
    });

    const config = await loadConfig(ctx);
    expect(config.maxComments).toBe(DEFAULT_CONFIG.maxComments);
  });
});
