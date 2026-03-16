# Claude Code

| | |
|---|---|
| **Home** | [claude.com/claude-code](https://claude.com/claude-code) · [GitHub](https://github.com/anthropics/claude-code) |
| **Engine name** | `claude` |
| **CLI command** | `claude` |
| **Instructions file** | `CLAUDE.md` |
| **Skills directory** | `.claude/skills/` |

**Install and authenticate:**

```bash
# Install (native installer — no Node.js required)
curl -fsSL https://claude.com/install | bash

# Or via npm
npm install -g @anthropic-ai/claude-code

# Authenticate (opens browser OAuth flow)
claude
```

Requires a Pro, Max, Teams, Enterprise, or API Console account. Credentials are stored in the system keychain.

**HAL usage:**

- **Config:** `engine.name: "claude"`. Optional: `engine.command`, `engine.model` (passed as `--model`), `engine.session` (`false` \| `true` \| `"shared"` \| `"user"`; see [Session configuration](../../config/session/README.md)), `engine.sessionMsg`.
- **Invocation:** `claude -p <prompt> --output-format stream-json --verbose [--model <m>] [--resume <sessionId>]` or `claude -c -p <prompt> ...` for shared mode.
- **Sessions:** `session: true` or `"user"` = per-user (`--resume {sessionId}`). `session: "shared"` = shared (`--continue`, all users in project `cwd`). `session: false` = stateless. `/clear` with shared mode sends the session message without `--continue` to start fresh; with per-user it clears the stored session and replies with a static message (no engine call).
- **Streaming:** JSONL output with live progress from tool-use events.
- **Project files:** `CLAUDE.md`, `.claude/settings.json`.

## Filesystem access and cwd boundary

**Not sandboxed by default — user must configure.** HAL passes no path-restriction flags to the Claude CLI. Claude Code manages its own permissions through `.claude/settings.json`, which HAL does not create or manage. Without explicit configuration, Claude Code can access the full filesystem.

**Why this matters:** Claude Code is git-aware. It walks up the directory tree from `cwd` to find and load `CLAUDE.md` files in every ancestor directory. This means it is aware of parent directories by design. It also has access to file tools (Read, Edit, Write, Bash) and by default can operate on any path the OS user has permission to access. If your project `cwd` is a subdirectory of a larger repository, Claude Code can reach the repository root and beyond without any prompt or warning.

**HAL's role:** HAL has no CLI flag to restrict Claude Code's filesystem access. The control surface is entirely within Claude Code's own settings. There is no `engine.claude.*` equivalent of Copilot's `allowAllPaths` — the mechanism simply does not exist at the CLI level.

**How to restrict access:** Add `allowedPaths` to the project's `.claude/settings.json`. This file lives in the project `cwd`:

```json
{
  "allowedPaths": ["/absolute/path/to/your/project"]
}
```

Or use a relative entry:

```json
{
  "allowedPaths": ["."]
}
```

With `allowedPaths` set, Claude Code's file tools are restricted to those directories. Shell commands via the `Bash` tool can still run arbitrary commands, so combine this with `disallowedTools: ["Bash"]` if you need strict confinement. See [Claude Code settings reference](https://docs.anthropic.com/en/docs/claude-code/settings) for the full schema.

## Available models

> **Last updated:** 2026-03-03 — [source](https://docs.anthropic.com/en/docs/claude-code/model-config)

Claude Code supports aliases (always resolve to latest version) and pinned full model names.

**Aliases:**

| Model | Description |
|-------|-------------|
| `default` | Account-recommended model (Sonnet or Opus by tier) |
| `sonnet` | Latest Sonnet (currently 4.6) |
| `opus` | Latest Opus (currently 4.6) |
| `haiku` | Fast and efficient Haiku |
| `sonnet[1m]` | Sonnet with 1M token context window |
| `opusplan` | Opus for planning, Sonnet for execution |

**Pinned model names:**

| Model | Description |
|-------|-------------|
| `claude-opus-4-6` | Claude Opus 4.6 — most intelligent, agents & coding |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 — best speed/intelligence balance |
| `claude-haiku-4-5` | Claude Haiku 4.5 — fastest, near-frontier |
| `claude-sonnet-4-5` | Claude Sonnet 4.5 |
| `claude-opus-4-5` | Claude Opus 4.5 |
| `claude-sonnet-4-0` | Claude Sonnet 4 |
| `claude-opus-4-1` | Claude Opus 4.1 |

### Instruction files and precedence

Claude Code uses **CLAUDE.md** only; it does **not** read `AGENTS.md` as a root instruction file. There is no built-in support for the AGENTS.md convention. HAL does not remap `.agents` for Claude Code — use `CLAUDE.md` and `.claude/skills/`.

**Chain of instructions:** Yes. Multiple CLAUDE.md files are loaded and form a hierarchy:

1. **Ancestor load (at startup):** Claude walks **up** the directory tree from the current working directory and loads `CLAUDE.md` and `CLAUDE.local.md` from each directory. So if you run Claude in `foo/bar/`, it loads both `foo/bar/CLAUDE.md` and `foo/CLAUDE.md`. More specific (closer to cwd) takes precedence when there is conflict.
2. **Subdirectories:** CLAUDE.md files in subdirectories **below** the cwd are **not** loaded at launch; they are loaded on demand when Claude reads files in those directories.
3. **Other locations:** User instructions `~/.claude/CLAUDE.md` (all projects); optional managed policy (org-wide, OS-dependent). Project instructions can be in `./CLAUDE.md` or `./.claude/CLAUDE.md`.

**If both AGENTS.md and CLAUDE.md exist:** Only CLAUDE.md is used. AGENTS.md is ignored.

You can pull in extra content from other files via `@path/to/file` imports inside CLAUDE.md, and use `.claude/rules/` for file-type–scoped rules. See [How Claude remembers your project](https://docs.anthropic.com/en/docs/claude-code/memory).

```yaml
engine:
  name: claude
  model: sonnet
  session: true
```

[← Back to engines index](../README.md)
