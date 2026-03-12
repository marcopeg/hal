# Context injection

Every message sent to the engine is automatically enriched with a structured context header. This provides metadata (message info, timestamps, custom values) so the AI can reason about the current request without extra tool calls.

You configure context in the main [configuration](../README.md) via the `context` key at root or per project.

## Implicit context (always-on)

These keys are injected for every message, even without any `context` configuration:

| Key | Description |
|-----|-------------|
| `bot.messageId` | Telegram message ID |
| `bot.timestamp` | Message Unix timestamp (seconds) |
| `bot.datetime` | Message datetime, ISO 8601 |
| `bot.userId` | Sender's Telegram user ID |
| `bot.username` | Sender's @username (if set) |
| `bot.firstName` | Sender's first name |
| `bot.chatId` | Chat ID |
| `bot.messageType` | `text` / `photo` / `document` / `voice` |
| `project.name` | Project name (falls back to project key if not set) |
| `project.cwd` | Resolved absolute project working directory |
| `project.slug` | Legacy key: path-derived slug from project cwd (`/` → `-`); slated to be removed or replaced by the project key |
| `sys.datetime` | Current local datetime with timezone |
| `sys.date` | Current date, `YYYY-MM-DD` |
| `sys.time` | Current time, `HH:MM:SS` |
| `sys.ts` | Current Unix timestamp (seconds) |
| `sys.tz` | Timezone name (e.g. `Europe/Berlin`) |
| `engine.name` | Engine identifier (e.g. `claude`, `copilot`) |
| `engine.command` | CLI command used to invoke the engine |
| `engine.model` | AI model from config (only present when explicitly set) |
| `engine.defaultModel` | HAL default model applied (only present when `engine.model` is omitted; see [Model defaults](../../engines/README.md#model-defaults)) |

Note: `project.slug` is legacy and should not be relied upon for stable identity.

## Custom context via config

Add a `context` object at the root level of your config (applies to all projects) or inside individual projects (overrides root per key):

```yaml
globals: {}
context:
  messageId: "${bot.messageId}"
  currentTime: "${sys.datetime}"
  buildVersion: "#{git rev-parse --short HEAD}"
projects:
  backend:
    cwd: ./backend
    telegram:
      botToken: "${BACKEND_BOT_TOKEN}"
    context:
      project: backend
      liveTimestamp: "@{date +\"%Y-%m-%d %H:%M:%S\"}"
```

Project context is merged on top of root — `backend` inherits `messageId`, `currentTime`, and `buildVersion` from root context, and adds `project` and `liveTimestamp`.

## Variable substitution patterns

Three patterns are supported wherever HAL resolves values against the context map:

| Pattern | Evaluated | Description |
|---------|-----------|-------------|
| `${expr}` | Per message / execution | Looks up `expr` in the full context map (implicit + configured keys), then env vars. Unresolved → empty string. |
| `#{cmd}` | Once at boot | Runs shell command, caches result for all messages |
| `@{cmd}` | Per message / execution | Runs shell command fresh for each message or cron execution |

### Where each pattern applies

| Location | `${expr}` | `#{cmd}` | `@{cmd}` |
|----------|-----------|----------|----------|
| Config `context:` values | ✅ | ✅ | ✅ |
| Cron `.md` prompt body | ✅ | ✗ | ✅ |
| Cron `.md` frontmatter | ✅ (env + process.env only, via `${VAR}`) | ✗ | ✗ |
| Skill prompt body | ✗ | ✗ | ✗ |
| Custom command (`.mjs`) | — (plain JS: use template literals / `process.env`) | — | — |

> Cron `.md` frontmatter uses a simpler resolver (env files + `process.env`); it does not have access to the full runtime context map (`bot.*`, `sys.*`, etc.).

## Context hooks

For advanced enrichment, you can provide a `context.mjs` hook file that transforms the context object with arbitrary JavaScript. Two hook locations are supported:

| Location | Scope |
|----------|-------|
| `{configDir}/.hal/hooks/context.mjs` | Global — runs for all projects |
| `{project.cwd}/.hal/hooks/context.mjs` | Project — runs for that project only |

When both exist, they chain: global runs first, its output feeds into the project hook. Both are **hot-reloaded** on every message (no restart needed) — so the AI engine itself can create or modify hooks at runtime.

```js
// .hal/hooks/context.mjs
export default async (context) => ({
  ...context,
  project: "my-tracker",
  user: await fetchUserProfile(context["bot.userId"])
})
```

- **Input**: fully-resolved `Record<string, string>` context
- **Output**: a `Record<string, string>` — the final context passed to the engine
- If a hook throws, the bot logs the error and falls back to the pre-hook context

## Prompt format

The resolved context is prepended to the user message before passing to the engine:

```
# Context
- bot.messageId: 12345
- sys.datetime: 2026-02-26 14:30:00 UTC+1
- project: backend

# User Message
What files changed today?
```

[← Back to Configuration](../README.md)
