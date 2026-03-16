# OpenCode

| | |
|---|---|
| **Home** | [opencode.ai](https://opencode.ai/) · [GitHub](https://github.com/opencode-ai/opencode) |
| **Engine name** | `opencode` |
| **CLI command** | `opencode` |
| **Instructions file** | `AGENTS.md` |
| **Skills directory** | `.agents/skills/`, `.opencode/skills/`, `.claude/skills/` |

**Install and authenticate:**

```bash
# Install via the official script
curl -fsSL https://opencode.ai/install | bash

# Or via npm / Homebrew / Scoop
npm install -g opencode
brew install opencode

# Authenticate (configure provider API keys)
opencode auth login
```

Supports 75+ LLM providers. Credentials are stored in `~/.local/share/opencode/auth.json`.

### Free tier / Zen

[OpenCode Zen](https://opencode.ai/docs/zen) is the curated free tier. To use it with HAL:

1. Install the CLI and run `opencode auth login` (no paid API key required for Zen).
2. In config, set `engine.name: "opencode"`. You can omit `engine.model` — HAL does not pass a model by default, so the OpenCode CLI uses its own default (e.g. Zen).
3. To pin a free model explicitly, set e.g. `engine.model: "opencode/gpt-5-nano"` (see [Zen models](https://opencode.ai/docs/zen)).

**HAL usage:**

- **Config:** `engine.name: "opencode"`. Optional: `engine.command`, `engine.model` (omit to use the OpenCode CLI default, or set e.g. `opencode/gpt-5-nano`), `engine.session` (`false` \| `true` \| `"shared"` only; see [Session configuration](../../config/session/README.md)), `engine.sessionMsg`.
- **Invocation:** `opencode run [-m <model>] [-c] <prompt>` with `OPENCODE_DISABLE_CLAUDE_CODE_PROMPT=true` env var. When `engine.model` is not set, HAL does not pass `-m`, so the CLI chooses the model.
- **Sessions:** `session: true` or `"shared"` = shared (`-c` continue last). **`session: "user"` is not supported:** HAL fails at **boot** with a configuration error. Use `true` or `"shared"`. `/clear` sends `engine.sessionMsg` without `-c` to start a fresh session.
- **Note:** OpenCode is a basic prompt/response adapter — no streaming progress events.
- **Project file:** `AGENTS.md`.

## Filesystem access and cwd boundary

**Not sandboxed — no HAL-level control available.** The OpenCode CLI (`opencode run`) has no sandbox or path-restriction flag. HAL spawns the process with `cwd` set to the project directory, but this only sets the default directory for relative paths — it does not prevent the agent from accessing files elsewhere.

**Why this matters:** OpenCode is a full agentic CLI with access to file tools and shell execution. It can read, write, and delete files at any path the OS user has permission to access. It is also aware of its git repository context, so it may naturally navigate to the repository root when interpreting prompts about project-wide tasks. There is no confirmation prompt in non-interactive mode.

**HAL's role:** There is no `engine.opencode.*` config flag that restricts path access. This is a limitation of the OpenCode CLI — it does not expose a sandboxing mechanism for headless use.

**Mitigation options (outside HAL):**
- Run HAL in a container or VM with limited filesystem access (Docker bind mounts scoped to the project directory are effective).
- Write an explicit instruction in `AGENTS.md` telling the agent to only create or modify files within the project directory — this is a soft guard only and relies on model compliance.
- Use OS-level tools (`chroot`, macOS sandbox profiles) to confine the process.

## Available models

> **Last updated:** 2026-03-03 — [source](https://opencode.ai/docs/zen)

OpenCode uses the `provider/model` format. The models below use [OpenCode Zen](https://opencode.ai/docs/zen) (`opencode/` prefix). You can also use direct provider models (e.g. `anthropic/claude-opus-4-6`, `openai/gpt-5.2`).

**OpenAI (via Zen):**

| Model | Description |
|-------|-------------|
| `opencode/gpt-5.3-codex` | GPT-5.3 Codex — most capable |
| `opencode/gpt-5.2-codex` | GPT-5.2 Codex — intelligent agentic coding |
| `opencode/gpt-5.2` | GPT-5.2 — general agentic |
| `opencode/gpt-5.1-codex` | GPT-5.1 Codex |
| `opencode/gpt-5.1-codex-max` | GPT-5.1 Codex Max — long-running tasks |
| `opencode/gpt-5.1-codex-mini` | GPT-5.1 Codex Mini — cost-effective |
| `opencode/gpt-5.1` | GPT-5.1 |
| `opencode/gpt-5-codex` | GPT-5 Codex |
| `opencode/gpt-5` | GPT-5 |
| `opencode/gpt-5-nano` | GPT-5 Nano — free |

**Anthropic (via Zen):**

| Model | Description |
|-------|-------------|
| `opencode/claude-opus-4-6` | Claude Opus 4.6 — most intelligent |
| `opencode/claude-sonnet-4-6` | Claude Sonnet 4.6 — balanced |
| `opencode/claude-sonnet-4-5` | Claude Sonnet 4.5 |
| `opencode/claude-opus-4-5` | Claude Opus 4.5 |
| `opencode/claude-haiku-4-5` | Claude Haiku 4.5 — fast |

**Google (via Zen):**

| Model | Description |
|-------|-------------|
| `opencode/gemini-3.1-pro` | Gemini 3.1 Pro |
| `opencode/gemini-3-pro` | Gemini 3 Pro |
| `opencode/gemini-3-flash` | Gemini 3 Flash — fast |

**Other (via Zen):**

| Model | Description |
|-------|-------------|
| `opencode/minimax-m2.5` | MiniMax M2.5 |
| `opencode/kimi-k2.5` | Kimi K2.5 |
| `opencode/glm-5` | GLM 5 |
| `opencode/big-pickle` | Big Pickle — free (stealth preview) |

### Instruction files and precedence

OpenCode uses **AGENTS.md** as the main instruction file. It also supports **CLAUDE.md** as a fallback for Claude Code compatibility. There is **no** merging of multiple instruction files from the same category — **first match wins** per category.

**Lookup order (first matching file wins in each category):**  
1. **Claude Code global:** `~/.claude/CLAUDE.md` (unless disabled via `OPENCODE_DISABLE_CLAUDE_CODE_PROMPT=1`).  
2. **OpenCode global:** `~/.config/opencode/AGENTS.md`.  
3. **Local:** Traverse **up** from the current directory; look for `AGENTS.md`, then `CLAUDE.md`. The **first** file found (e.g. first AGENTS.md or CLAUDE.md on the path) is used.

**If both AGENTS.md and CLAUDE.md exist in the same directory:** Only **AGENTS.md** is used; CLAUDE.md is ignored in that directory.

**Custom instructions** in `opencode.json` (e.g. `instructions` field) are **combined** with the chosen AGENTS.md/CLAUDE.md file. So you get one “rules file” from the precedence above, plus any files referenced in config. See [Rules - AGENTS.md Project Guidelines](https://open-code.ai/docs/en/rules).

```yaml
engine:
  name: opencode
  model: opencode/gpt-5-nano
```

[← Back to engines index](../README.md)
