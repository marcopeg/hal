# GitHub Copilot

| | |
|---|---|
| **Home** | [github.com/features/copilot/cli](https://github.com/features/copilot/cli) · [GitHub](https://github.com/github/copilot-cli) |
| **Engine name** | `copilot` |
| **CLI command** | `copilot` |
| **Instructions file** | `AGENTS.md` |
| **Skills directory** | `.agents/skills/`, `.github/skills/`, `.claude/skills/` |

**Install and authenticate:**

```bash
# Install via npm (requires Node.js 22+)
npm install -g @github/copilot

# Or via Homebrew
brew install --cask copilot-cli

# Authenticate (interactive — follow the prompts)
copilot
# Then use /login inside the CLI
```

Requires a Copilot Pro, Pro+, Business, or Enterprise plan. You can also authenticate via a fine-grained personal access token with the "Copilot Requests" permission, using the `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_TOKEN` environment variable.

**HAL usage:**

- **Config:** `engine.name: "copilot"`. Optional: `engine.command`, `engine.model`, `engine.session` (`false` \| `true` \| `"shared"` \| `"user"`; see [Session configuration](../../config/session/README.md)), `engine.sessionMsg`, `engine.copilot.allowAllPaths`.
- **Invocation:** `copilot -p <prompt> --allow-all-tools --allow-all-urls [--allow-all-paths] [--model <m>] [--resume <UUID> | --continue]`
- **Sessions:** `session: true` or omitted = **experimental per-user** mode. HAL runs Copilot with `--output-format json`, reads the session UUID from the final JSON `result` event, and resumes with `copilot --resume <UUID>`. `session: "shared"` keeps the old shared `--continue` behavior. `session: false` is stateless.
- **`/clear` behavior:** in Copilot `"user"` mode, `/clear` only deletes the user’s local `session.json`. In Copilot `"shared"` mode, `/clear` still sends `engine.sessionMsg` without `--continue` to start a fresh shared session.
- **Project file:** `AGENTS.md`.

## Per-user Copilot session recovery

Copilot can emit structured JSONL output in non-interactive mode. HAL uses `--output-format json --stream off` and reads the session UUID from the final `result` event.

In Copilot `"user"` mode HAL does the following:

- execute the prompt with structured JSON output enabled
- parse the final `result` event for `sessionId`
- persist that UUID in the Telegram user’s `session.json`
- resume later turns with `copilot --resume <UUID>`

This is more reliable than guessing from Copilot's local session-state directory layout.

If HAL cannot recover a new Copilot UUID after a fresh run:

- HAL does **not** fall back to shared `--continue` continuation
- HAL warns the Telegram user that continuity is temporarily unavailable
- HAL logs the failure for the operator
- future messages run fresh until HAL can recover a real UUID again

If a previously stored UUID becomes stale and Copilot can no longer resume it, HAL clears the stale local session, retries the current prompt as a fresh run, warns the Telegram user that continuity was reset, and attempts to discover a new UUID for future turns

## Filesystem access and cwd boundary

**Safe by default.** HAL passes `--allow-all-tools` and `--allow-all-urls` but deliberately omits `--allow-all-paths`, which is Copilot’s flag to disable path verification. Without it, Copilot restricts file read/write operations to the project `cwd` and its subdirectories.

**Why this matters:** Copilot is git-aware. When it runs inside a git repository, it automatically discovers the repository root (via `git rev-parse --show-toplevel`) and treats it as a natural project boundary. In the past, HAL used `--allow-all` (which bundles `--allow-all-paths`), allowing Copilot to act on its git-root knowledge and write files anywhere in the repository tree — or beyond. For example, if your project `cwd` is `examples/my-project/` inside a larger repo, Copilot could write files to the repository root without being prompted.

**HAL’s mitigation:** `--allow-all-paths` is not passed. Copilot’s built-in path verification is active, and the agent is confined to `cwd` and its descendants.

**Opt-out:** If you have a legitimate need to let the agent work across the repository (e.g. a monorepo setup where the agent must touch files at the root), set:

```yaml
engine:
  copilot:
    allowAllPaths: true
```

This re-enables `--allow-all-paths`. Use with care — it removes all filesystem boundaries.

## Available models

> **Last updated:** 2026-03-03 — [source](https://docs.github.com/en/copilot/reference/ai-models/supported-models)

Models marked 0x are free (no premium requests on paid plans). Multiplier shown in parentheses.

**Anthropic:**

| Model | Description |
|-------|-------------|
| `claude-sonnet-4.6` | Claude 4.6 Sonnet — balanced performance |
| `claude-opus-4.6` | Claude 4.6 Opus — most capable (3x) |
| `claude-opus-4-6-fast` | Claude 4.6 Opus fast mode — preview (30x) |
| `claude-sonnet-4.5` | Claude 4.5 Sonnet |
| `claude-sonnet-4` | Claude 4 Sonnet |
| `claude-opus-4.5` | Claude 4.5 Opus (3x) |
| `claude-haiku-4.5` | Claude 4.5 Haiku — fast (0.33x) |

**OpenAI:**

| Model | Description |
|-------|-------------|
| `gpt-5.3-codex` | Latest Codex model |
| `gpt-5.2-codex` | GPT-5.2 Codex |
| `gpt-5.2` | GPT-5.2 general agentic |
| `gpt-5.1-codex-max` | GPT-5.1 Codex Max |
| `gpt-5.1-codex` | GPT-5.1 Codex |
| `gpt-5.1-codex-mini` | GPT-5.1 Codex Mini — preview (0.33x) |
| `gpt-5.1` | GPT-5.1 |
| `gpt-5-mini` | GPT-5 Mini — free (0x) |
| `gpt-4.1` | GPT-4.1 — free (0x) |

**Google:**

| Model | Description |
|-------|-------------|
| `gemini-3.1-pro` | Gemini 3.1 Pro — preview |
| `gemini-3-pro` | Gemini 3 Pro — preview |
| `gemini-3-flash` | Gemini 3 Flash — preview (0.33x) |
| `gemini-2.5-pro` | Gemini 2.5 Pro |

**Other:**

| Model | Description |
|-------|-------------|
| `grok-code-fast-1` | xAI Grok Code Fast 1 (0.25x) |
| `raptor-mini` | Fine-tuned GPT-5 Mini — preview |
| `goldeneye` | Fine-tuned GPT-5.1-Codex — preview |

### Instruction files and precedence

Copilot supports **AGENTS.md** as the primary agent instruction file. It also supports GitHub’s own instruction layers: repository-wide (`.github/copilot-instructions.md`) and path-specific (`.github/instructions/*.instructions.md`).

**Agent instructions (one wins per context):** For the coding agent, **the nearest `AGENTS.md` in the directory tree** is used. Alternatively you can use a **single** `CLAUDE.md` or `GEMINI.md` in the **repository root** (not nested). So: either one nearest AGENTS.md, or one root CLAUDE.md/GEMINI.md — not both agent formats at once for the same scope.

**Chain with GitHub instructions:** When both repository-wide and path-specific instructions exist, **both are used**: repository-wide first, then path-specific instructions are appended when their globs match the files in context. Agent instructions (AGENTS.md or root CLAUDE.md/GEMINI.md) work **alongside** `.github/copilot-instructions.md` — all applicable layers are combined. So: `.github/copilot-instructions.md` + matching `.github/instructions/*.instructions.md` + (nearest AGENTS.md **or** root CLAUDE.md **or** root GEMINI.md).

**If both AGENTS.md and .github/copilot-instructions.md exist:** Both are loaded and combined; Copilot uses repository-wide instructions and the nearest agent instruction file together.

See [Adding repository custom instructions for GitHub Copilot](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot).

```yaml
engine:
  name: copilot
  model: claude-sonnet-4.6
  session: true
```

[← Back to engines index](../README.md)
