import type { Probot } from "probot";
import { handlePullRequest } from "./handlers/pull-request.js";

export default function app(robot: Probot): void {
  robot.on(["pull_request.opened", "pull_request.synchronize"], handlePullRequest);
}
