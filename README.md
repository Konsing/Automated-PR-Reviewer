# AI PR Reviewer

A GitHub App that automatically reviews pull requests using AI.

Built with [Probot](https://probot.github.io/) and powered by [Groq](https://groq.com/)'s Llama 3.3 70B model (free tier), it posts inline review comments directly on your PR diffs and auto-labels PRs by finding category.

## How It Works

```
PR opened / updated
        |
        v
GitHub sends webhook
        |
        v
Fetch changed files & diffs
        |
        v
Filter files (skip locks, images, ignored paths)
        |
        v
Batch diffs by size
        |
        v
Send to Groq LLM (Llama 3.3 70B)
        |
        v
Parse JSON response & validate comments
        |
        v
Map LLM line numbers --> GitHub diff positions
        |
        v
Post inline review comments + Apply labels
```

## Features

- **Inline code review comments** on specific diff lines, not just PR-level summaries
- **5 severity categories** with emoji badges: bug, security, performance, suggestion, style
- **Auto-labels PRs** based on review findings (e.g., `ai:bug-found`, `ai:clean-review`)
- **Configurable** via `.pr-reviewer.yml` in your repo (strictness level, ignored paths, max comments)
- **Rate limit handling** with exponential backoff and retry logic
- **Large PR handling** — automatically filters out binary/generated files, truncates oversized patches, and batches diffs to stay within token limits

## Setup

### Prerequisites

- Node.js 18+
- A GitHub account
- A Groq API key (free at [https://console.groq.com/keys](https://console.groq.com/keys))

### Clone & Install

```bash
git clone https://github.com/your-username/Automated-PR-Reviewer.git
cd Automated-PR-Reviewer
npm install
npm run build
```

### Create a GitHub App

Run the Probot setup wizard:

```bash
npx probot run ./dist/index.js
```

Follow the browser prompts to register a new GitHub App. The wizard will generate your `APP_ID`, `PRIVATE_KEY`, and `WEBHOOK_SECRET` automatically and write them to a `.env` file.

**Required permissions:**

| Permission       | Access  |
| ---------------- | ------- |
| Pull requests    | Write   |
| Contents         | Read    |
| Issues           | Write   |

**Required event subscriptions:**

- `pull_request`

### Environment Variables

Create a `.env` file (or set these in your hosting platform):

| Variable            | Required | Description                                              |
| ------------------- | -------- | -------------------------------------------------------- |
| `APP_ID`            | Yes      | GitHub App ID (from setup wizard)                        |
| `PRIVATE_KEY`       | Yes      | GitHub App private key (PEM format)                      |
| `WEBHOOK_SECRET`    | Yes      | Webhook secret (from setup wizard)                       |
| `GROQ_API_KEY`      | Yes      | Groq API key for LLM access                             |
| `WEBHOOK_PROXY_URL` | No       | Smee.io URL for local development webhook forwarding     |

### Local Development

Use [smee-client](https://github.com/probot/smee-client) to forward GitHub webhooks to your local machine:

```bash
# 1. Create a channel at https://smee.io/new and set WEBHOOK_PROXY_URL in .env

# 2. Start the app in dev mode
npm run dev
```

The `dev` script builds TypeScript and starts the Probot server. When `WEBHOOK_PROXY_URL` is set, Probot automatically connects to the Smee proxy.

## Configuration

Add a `.pr-reviewer.yml` file to the root of any repo where the app is installed:

```yaml
# Review strictness: low | moderate | strict
#   low      — Only flag critical bugs and security issues
#   moderate — Bugs, security, and significant suggestions (default)
#   strict   — Comprehensive review including style and best practices
strictness: moderate

# Glob patterns for files to skip (in addition to built-in skips)
ignore:
  - "docs/**"
  - "*.test.ts"
  - "migrations/**"

# Maximum number of inline comments per review
max_comments: 25
```

**Option details:**

| Option         | Type       | Default      | Description                                                                                          |
| -------------- | ---------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| `strictness`   | `string`   | `"moderate"` | Controls review depth. `low` catches only critical issues. `strict` reviews everything thoroughly.    |
| `ignore`       | `string[]` | `[]`         | Glob patterns for files to skip. Added on top of built-in skips (lock files, images, dist/, etc.).    |
| `max_comments` | `number`   | `25`         | Cap on inline comments per review. Prevents noisy reviews on large PRs.                              |

If no `.pr-reviewer.yml` is found, the app uses the defaults above.

## PR Labels

The app automatically creates and applies labels to reviewed PRs:

| Label                  | Color                                          | Meaning                                  |
| ---------------------- | ---------------------------------------------- | ---------------------------------------- |
| `ai:bug-found`         | ![#d73a4a](https://placehold.co/12x12/d73a4a/d73a4a) Red    | Potential bugs detected                  |
| `ai:security-concern`  | ![#e36209](https://placehold.co/12x12/e36209/e36209) Orange | Security issues flagged                  |
| `ai:performance`       | ![#fbca04](https://placehold.co/12x12/fbca04/fbca04) Yellow | Performance concerns found               |
| `ai:suggestion`        | ![#0075ca](https://placehold.co/12x12/0075ca/0075ca) Blue   | General improvement suggestions          |
| `ai:style`             | ![#c5c5c5](https://placehold.co/12x12/c5c5c5/c5c5c5) Gray  | Code style or formatting issues          |
| `ai:clean-review`      | ![#0e8a16](https://placehold.co/12x12/0e8a16/0e8a16) Green  | No issues found — clean PR               |

Labels are created automatically on first use. A PR can have multiple labels if issues span categories.

## Deploy to Railway

[Railway](https://railway.app/) auto-detects the Node.js runtime and runs `npm start`.

1. Push your repo to GitHub.
2. Create a new project on Railway and connect your repo.
3. Add the environment variables (`APP_ID`, `PRIVATE_KEY`, `WEBHOOK_SECRET`, `GROQ_API_KEY`) in the Railway dashboard under **Variables**.
4. Once deployed, copy the Railway-provided URL.
5. Update your GitHub App's webhook URL to point to your Railway URL (e.g., `https://your-app.up.railway.app/`).

**Note:** The `PRIVATE_KEY` environment variable must contain actual newlines, not the literal string `\n`. In Railway's dashboard, paste the full PEM content directly — Railway preserves multiline values.

## Tech Stack

- **TypeScript** — strict mode, ES2022 target, ESM
- **Probot** v14 — GitHub App framework
- **Groq SDK** — LLM API client
- **Llama 3.3 70B Versatile** — code review model (free tier)
- **js-yaml** — config file parsing
- **minimatch** — glob pattern matching for file filtering
- **Vitest** — test runner

## License

ISC
