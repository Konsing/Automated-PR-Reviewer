import type { Context } from "probot";
import type { Category } from "../types/index.js";
import { LABEL_MAP } from "../types/index.js";

export async function applyLabels(
  context: Context<"pull_request">,
  categories: Set<Category>,
): Promise<void> {
  const { owner, repo } = context.repo();
  const issueNumber = context.payload.pull_request.number;

  const labels: string[] = [];

  if (categories.size === 0) {
    labels.push(LABEL_MAP.clean.name);
    await ensureLabelExists(context, LABEL_MAP.clean.name, LABEL_MAP.clean.color);
  } else {
    for (const category of categories) {
      const labelDef = LABEL_MAP[category];
      if (labelDef) {
        labels.push(labelDef.name);
        await ensureLabelExists(context, labelDef.name, labelDef.color);
      }
    }
  }

  if (labels.length > 0) {
    await context.octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });
  }
}

async function ensureLabelExists(
  context: Context<"pull_request">,
  name: string,
  color: string,
): Promise<void> {
  const { owner, repo } = context.repo();
  try {
    await context.octokit.rest.issues.createLabel({ owner, repo, name, color });
  } catch (error: unknown) {
    // 422 means the label already exists — that's fine
    if (!isValidationError(error)) {
      throw error;
    }
  }
}

function isValidationError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === 422
  );
}
