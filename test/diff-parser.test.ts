import { describe, it, expect } from "vitest";
import { filterFiles, parseDiffs } from "../src/services/diff-parser.js";
import type { PullFile, ReviewConfig } from "../src/types/index.js";
import {
  normalTsFile,
  normalJsFile,
  lockFile,
  yarnLockFile,
  imageFile,
  removedFile,
  binaryFile,
  docsFile,
  testFile,
  samplePullFiles,
  defaultConfig,
  configWithIgnorePatterns,
  createManyFilesWithUniqueChanges,
} from "./fixtures/index.js";

// ---------------------------------------------------------------------------
// filterFiles
// ---------------------------------------------------------------------------

describe("filterFiles", () => {
  it("skips package-lock.json", () => {
    const result = filterFiles([normalTsFile, lockFile], defaultConfig);
    expect(result.map((f) => f.filename)).not.toContain("package-lock.json");
  });

  it("skips yarn.lock", () => {
    const result = filterFiles([normalTsFile, yarnLockFile], defaultConfig);
    expect(result.map((f) => f.filename)).not.toContain("yarn.lock");
  });

  it("skips pnpm-lock.yaml", () => {
    const pnpmLock: PullFile = {
      filename: "pnpm-lock.yaml",
      status: "modified",
      additions: 50,
      deletions: 30,
      changes: 80,
      patch: "@@ -1,3 +1,3 @@\n-a\n+b\n",
    };
    const result = filterFiles([normalTsFile, pnpmLock], defaultConfig);
    expect(result.map((f) => f.filename)).not.toContain("pnpm-lock.yaml");
  });

  it("skips binary/image files (png)", () => {
    const result = filterFiles([normalTsFile, imageFile], defaultConfig);
    expect(result.map((f) => f.filename)).not.toContain("assets/logo.png");
  });

  it("skips .jpg files", () => {
    const jpgFile: PullFile = {
      filename: "assets/photo.jpg",
      status: "added",
      additions: 0,
      deletions: 0,
      changes: 0,
      patch: undefined,
    };
    const result = filterFiles([normalTsFile, jpgFile], defaultConfig);
    expect(result.map((f) => f.filename)).not.toContain("assets/photo.jpg");
  });

  it("skips removed files", () => {
    const result = filterFiles([normalTsFile, removedFile], defaultConfig);
    expect(result.map((f) => f.filename)).not.toContain("src/old-module.ts");
  });

  it("skips files without patches", () => {
    const result = filterFiles([normalTsFile, binaryFile], defaultConfig);
    expect(result.map((f) => f.filename)).not.toContain("dist/bundle.min.js");
  });

  it("skips files matching config.ignore patterns (docs/**)", () => {
    const result = filterFiles([normalTsFile, docsFile], configWithIgnorePatterns);
    expect(result.map((f) => f.filename)).not.toContain("docs/getting-started.md");
  });

  it("skips files matching config.ignore patterns (*.test.ts)", () => {
    const result = filterFiles([normalTsFile, testFile], configWithIgnorePatterns);
    expect(result.map((f) => f.filename)).not.toContain("src/utils/helpers.test.ts");
  });

  it("keeps normal source files", () => {
    const result = filterFiles(samplePullFiles, defaultConfig);
    const filenames = result.map((f) => f.filename);
    expect(filenames).toContain("src/utils/helpers.ts");
    expect(filenames).toContain("src/index.js");
  });

  it("caps at 30 files when input exceeds 50, sorted by changes descending", () => {
    const manyFiles = createManyFilesWithUniqueChanges(60);
    const result = filterFiles(manyFiles, defaultConfig);

    expect(result).toHaveLength(30);

    // The files with the highest `changes` values should survive.
    // createManyFilesWithUniqueChanges gives file-000 changes=60, file-001 changes=59, etc.
    // So the top-30 should be file-000 through file-029.
    const filenames = result.map((f) => f.filename);
    expect(filenames[0]).toBe("src/file-000.ts"); // highest changes
    expect(filenames[29]).toBe("src/file-029.ts"); // 30th highest

    // Verify ordering — changes should be descending.
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].changes).toBeGreaterThanOrEqual(result[i].changes);
    }
  });

  it("does NOT cap when input is exactly 50 files", () => {
    const fiftyFiles = createManyFilesWithUniqueChanges(50);
    const result = filterFiles(fiftyFiles, defaultConfig);
    expect(result).toHaveLength(50);
  });

  it("returns empty array when all files are filtered out", () => {
    const result = filterFiles([lockFile, imageFile, removedFile, binaryFile], defaultConfig);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseDiffs
// ---------------------------------------------------------------------------

describe("parseDiffs", () => {
  it("converts PullFiles to DiffChunks correctly", () => {
    const files: PullFile[] = [normalTsFile, normalJsFile];
    const chunks = parseDiffs(files);

    expect(chunks).toHaveLength(2);

    expect(chunks[0].filename).toBe("src/utils/helpers.ts");
    expect(chunks[0].patch).toBe(normalTsFile.patch);
    expect(chunks[0].additions).toBe(normalTsFile.additions);
    expect(chunks[0].deletions).toBe(normalTsFile.deletions);
    expect(chunks[0].status).toBe(normalTsFile.status);

    expect(chunks[1].filename).toBe("src/index.js");
    expect(chunks[1].status).toBe("added");
  });

  it("truncates patches longer than 8000 characters", () => {
    const longPatch = "@@ -1,3 +1,3 @@\n" + "+".repeat(9000);
    const file: PullFile = {
      filename: "src/big-file.ts",
      status: "modified",
      additions: 100,
      deletions: 0,
      changes: 100,
      patch: longPatch,
    };

    const chunks = parseDiffs([file]);
    expect(chunks[0].patch.length).toBeLessThan(longPatch.length);
    expect(chunks[0].patch.length).toBe(8000 + "\n... (truncated)".length);
    expect(chunks[0].patch).toContain("... (truncated)");
  });

  it("does not truncate patches at or below 8000 characters", () => {
    const exactPatch = "@@ -1,3 +1,3 @@\n" + "x".repeat(8000 - "@@ -1,3 +1,3 @@\n".length);
    const file: PullFile = {
      filename: "src/exact.ts",
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: exactPatch,
    };

    const chunks = parseDiffs([file]);
    expect(chunks[0].patch).toBe(exactPatch);
  });

  it("handles files with undefined patch gracefully", () => {
    const file: PullFile = {
      filename: "src/no-patch.ts",
      status: "modified",
      additions: 0,
      deletions: 0,
      changes: 0,
      patch: undefined,
    };

    const chunks = parseDiffs([file]);
    expect(chunks[0].patch).toBe("");
  });
});
