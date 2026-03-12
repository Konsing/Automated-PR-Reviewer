import type { Context } from "probot";
import { loadConfig } from "../services/config-loader.js";
import { filterFiles, parseDiffs } from "../services/diff-parser.js";
import { reviewDiffs } from "../services/groq-client.js";
import { applyLabels } from "../services/label-manager.js";
import { buildReviewComments } from "../services/review-builder.js";
import type { PullFile } from "../types/index.js";

export async function handlePullRequest(context: Context<"pull_request">): Promise<void> {
  const pr = context.payload.pull_request;
  const logger = context.log;

  logger.info(`Reviewing PR #${pr.number}: ${pr.title}`);

  try {
    // 1. Load repo-level config
    const config = await loadConfig(context);
    logger.info(`Config: strictness=${config.strictness}, maxComments=${config.maxComments}, ignore=${config.ignore.length} patterns`);

    // 2. Fetch changed files
    const { owner, repo } = context.repo();
    const { data: files } = await context.octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
      per_page: 100,
    });

    // 3. Filter and parse diffs
    const filtered = filterFiles(files as PullFile[], config);
    if (filtered.length === 0) {
      logger.info("No reviewable files found — skipping review");
      return;
    }

    const chunks = parseDiffs(filtered);
    logger.info(`Reviewing ${chunks.length} files`);

    // 4. Send to LLM for review
    const llmComments = await reviewDiffs(chunks, config, logger);
    logger.info(`LLM returned ${llmComments.length} comments`);

    // 5. Build GitHub review comments
    const { comments, categories } = buildReviewComments(llmComments, chunks, config);

    // 6. Post review
    if (comments.length > 0) {
      await context.octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pr.number,
        event: "COMMENT",
        comments,
      });
      logger.info(`Posted review with ${comments.length} inline comments`);
    } else {
      logger.info("No actionable comments — skipping review post");
    }

    // 7. Apply labels
    await applyLabels(context, categories);
    logger.info("Labels applied");
  } catch (error) {
    // Log but never re-throw — prevents GitHub retry storms
    logger.error(`Error reviewing PR #${pr.number}: ${error}`);
  }
}
