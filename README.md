<p align="center">
  <img src="https://raw.githubusercontent.com/marcopeg/hal/main/images/hal.jpg" alt="HAL 9000" width="120" />
</p>

<h1 align="center">HAL</h1>

A Telegram bot that provides access to AI coding agents as a personal assistant. Run multiple engines (Claude Code, GitHub Copilot, and more) across multiple projects simultaneously, each with its own dedicated Telegram bot.

## Features

- **Multi-engine support** — use Claude Code, GitHub Copilot, Codex, OpenCode, or Antigravity per project
- **Multi-project support** — run multiple bots from a single config, each connected to a different directory
- Chat with your AI coding agent via Telegram
- Send images and documents for analysis
- **Voice message support** with local Whisper transcription
- **File sending** — the engine can send files back to you
- **Context injection** — every message includes metadata (timestamps, user info, custom values) and supports hot-reloaded hooks
- **Custom slash commands** — add `.mjs` command files per-project or globally; hot-reloaded so the engine can create new commands at runtime
- **Skills** — `.claude/skills/` entries are automatically exposed as Telegram slash commands; no extra setup needed
- Persistent conversation sessions per user
- Per-project access control, rate limiting, and logging
- Log persistence to file with daily rotation support

## How It Works

This tool runs one AI coding agent subprocess per project, each in its configured working directory. The default engine is Claude Code, but each project can use a different engine.

The engine reads its standard config files from the project directory:

- `CLAUDE.md` / `AGENTS.md` — Project-specific instructions and context (filename depends on engine)
- `.claude/settings.json` — Permissions and tool settings (Claude Code)
- `.claude/commands/` — Custom slash commands
- `.mcp.json` — MCP server configurations

You get the full power of your chosen AI coding agent — file access, code execution, configured MCP tools — all accessible through Telegram.

## 🤖 AI Providers

This is the list of the currently supported agentic platforms:

- [OpenCode](docs/providers/opencode/README.md)
- [Codex](docs/providers/codex/README.md)
- [Claude Code](docs/providers/claude/README.md)
- [Copilot](docs/providers/copilot/README.md)
- [Cursor](docs/providers/cursor/README.md)
- [Antigravity](docs/providers/antigravity/README.md)

Each provider has pros/cons and some limitations.  
Here we try to keep updated a feature comparison table:

| Feature | [OpenCode](docs/providers/opencode/README.md) | [Codex](docs/providers/codex/README.md) | [Claude Code](docs/providers/claude/README.md) | [Copilot](docs/providers/copilot/README.md) | [Cursor](docs/providers/cursor/README.md) | [Antigravity](docs/providers/antigravity/README.md) |
|--------|:--------:|:-----:|:------:|:-------:|:------:|:------------:|
| **Instruction file** | `AGENTS.md` | `AGENTS.md` | `CLAUDE.md` | `AGENTS.md` | `AGENTS.md` | `GEMINI.md` |
| **Main skills folder** | `.agents/skills/` | `.agents/skills/` | `.claude/skills/` | `.agents/skills/` | `.agents/skills/` | `.agent/skills/` |
| **Per-user session** | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |
| **Network access** | — | ✓ | — | — | — | — |
| **Full disk access** | — | ✓ | — | — | — | — |
| **YOLO mode** | — | ✓ | — | — | — | ✓ |
| **Streaming progress** | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |

Read more in the [Providers](docs/providers/README.md) docs.

## Prerequisites

- Node.js 18+
- At least one supported AI coding CLI installed and authenticated
- A Telegram bot token per project (from [@BotFather](https://t.me/BotFather)) — see [Creating a Telegram Bot](#creating-a-telegram-bot)
- **ffmpeg** (required for voice messages) — `brew install ffmpeg` on macOS

## Quick Start

```bash
# Create hal.config.json in the current directory
npx @marcopeg/hal init

# Or in a specific folder (config and bots will use that directory)
npx @marcopeg/hal init --cwd ./workspace

# Optional: pick engine at init
npx @marcopeg/hal init --engine copilot
npx @marcopeg/hal init --cwd ./workspace --engine copilot

# Edit hal.config.json: add your bot token and project path, then start
npx @marcopeg/hal
npx @marcopeg/hal --cwd ./workspace
```

## Configuration

HAL is configured via `hal.config.json` (and optional `hal.config.local.json`) in the directory where you run the CLI. Full reference:

- **[Configuration](docs/config/README.md)** — config files, env vars, `globals`, `projects[]`, dataDir, log files, directory structure
- **[Context](docs/config/context/README.md)** — context injection (implicit keys, custom context, hooks)
- **[Commands](docs/config/commands/README.md)** — built-in command config (`/start`, `/help`, `/reset`, `/clean`, `/model`, `/git`)
- **[Engine and models](docs/config/engine/README.md)** — engine selection, providers model list, model defaults
- **[Providers](docs/providers/README.md)** — per-engine setup and options (Claude, Copilot, Codex, etc.)

<details>
<summary>Minimal config example</summary>

Create a `hal.config.json` in your workspace. Use `${VAR_NAME}` for secrets and set them in `.env.local`.

```json
{
  "globals": {
    "engine": { "name": "claude" },
    "logging": { "level": "info", "flow": true, "persist": false },
    "rateLimit": { "max": 10, "windowMs": 60000 },
    "access": { "allowedUserIds": [] }
  },
  "projects": [
    {
      "name": "backend",
      "cwd": "./backend",
      "telegram": { "botToken": "${BACKEND_BOT_TOKEN}" },
      "access": { "allowedUserIds": [123456789] },
      "logging": { "persist": true }
    },
    {
      "name": "frontend",
      "cwd": "./frontend",
      "engine": { "name": "copilot", "model": "gpt-5-mini" },
      "telegram": { "botToken": "${FRONTEND_BOT_TOKEN}" },
      "access": { "allowedUserIds": [123456789] }
    }
  ]
}
```

</details>

## Bot Commands

| Command  | Description                                           |
|----------|-------------------------------------------------------|
| `/start` | Welcome message                                       |
| `/help`  | Show help information                                 |
| `/reset` | Wipes out all user data and resets the LLM session    |
| `/clean` | Resets the LLM session                                |

## Custom Commands

You can add your own slash commands as `.mjs` files. When a user sends `/mycommand`, the bot looks for a matching file before passing the message to Claude.

### File locations

| Location | Scope |
|----------|-------|
| `{project.cwd}/.hal/commands/{name}.mjs` | Project-specific |
| `{configDir}/.hal/commands/{name}.mjs` | Global — available to all projects |

Project-specific commands take precedence over global ones on name collision.

### Command file format

```js
// .hal/commands/deploy.mjs
export const description = 'Deploy the project'; // shown in Telegram's / menu

export default async function({ args, ctx, projectCtx }) {
  const env = args[0] ?? 'staging';
  return `Deploying to ${env}...`;
}
```

The only required export is `description` (shown in Telegram's `/` suggestion menu) and a `default` function. The return value is sent to the user as a message. Return `null` or `undefined` to suppress the reply (e.g. if your command sends its own response via `gram`).

### Handler arguments

#### `args: string[]`

Tokens following the command name, split on whitespace.

```
/deploy staging eu-west  →  args = ['staging', 'eu-west']
/status                  →  args = []
```

#### `ctx: Record\<string, string\>`

The fully-resolved context that would be sent to the AI for this message — identical to what the engine sees in its `# Context` header. Includes all implicit keys plus any config vars and hook results:

| Key group | Description |
|-----------|-------------|
| `bot.*` | `bot.userId`, `bot.username`, `bot.firstName`, `bot.chatId`, `bot.messageId`, `bot.timestamp`, `bot.datetime`, `bot.messageType` |
| `sys.*` | `sys.date`, `sys.time`, `sys.datetime`, `sys.ts`, `sys.tz` |
| `project.*` | `project.name`, `project.cwd`, `project.slug` |
| `engine.*` | `engine.name`, `engine.command`, `engine.model` (if set), `engine.defaultModel` (if HAL default applied) |
| custom | Any keys defined in `context` config blocks, after `${}` / `#{}` / `@{}` substitution and context hook transforms |

Use `/context` (the built-in global command) to inspect the exact keys available at runtime.

#### `gram: Grammy Context`

The raw [Grammy](https://grammy.dev) message context, giving direct access to the Telegram Bot API. Only needed for advanced use cases: sending multiple messages, editing or deleting messages, uploading files, reacting to messages, etc.

Common patterns:

```js
// Send a temporary status message, then delete it
const status = await gram.reply('Working...');
// ... do work ...
await gram.api.deleteMessage(gram.chat.id, status.message_id);

// Edit the status message while working
await gram.api.editMessageText(gram.chat.id, status.message_id, 'Still working...');

// React to the original message
await gram.react([{ type: 'emoji', emoji: '👍' }]);

// Send a file
await gram.replyWithDocument(new InputFile('/path/to/file.pdf'));
```

When using `gram` to send your own reply, return `null` or `undefined` to suppress the default text reply:

```js
export default async function({ gram }) {
  await gram.reply('Done!');
  return null;
}
```

#### `agent: Agent`

An engine-agnostic interface for making one-shot AI calls from within a command. The underlying provider is configured per-project — currently Claude Code, with support for other engines planned. Command handlers always use this interface and never talk to any engine directly.

```ts
interface Agent {
  call(
    prompt: string,
    options?: { onProgress?: (message: string) => void }
  ): Promise\<string\>;
}
```

Unlike regular user messages, agent calls have no session history and no context header prepended — the prompt is sent to the engine as-is.

| Option | Type | Description |
|--------|------|-------------|
| `onProgress` | `(message: string) => void` | Called during execution with activity updates (e.g. `"Reading: /path/to/file"`). Use it to keep the user informed while the agent is working. |

Returns the agent's final text output as a string. Throws on failure — the bot's command error handler will catch it and reply with `Command failed: {message}`.

```js
export default async function({ args, gram, agent }) {
  const status = await gram.reply('Thinking...');

  const answer = await agent.call(`Summarise: ${args.join(' ')}`, {
    onProgress: async (activity) => {
      try {
        await gram.api.editMessageText(gram.chat.id, status.message_id, `⏳ ${activity}`);
      } catch { /* ignore if message was already edited */ }
    },
  });

  await gram.api.deleteMessage(gram.chat.id, status.message_id);
  return answer;
}
```

See [`examples/.hal/commands/joke.mjs`](examples/.hal/commands/joke.mjs) for a full example that combines `gram` for live status cycling with `agent.call` + `onProgress` for activity updates.

#### `projectCtx: ProjectContext`

The project-level context object. Useful fields:

| Field | Type | Description |
|-------|------|-------------|
| `projectCtx.config.name` | `string \| undefined` | Project name from config |
| `projectCtx.config.slug` | `string` | Internal slug (used for log/data paths) |
| `projectCtx.config.cwd` | `string` | Absolute path to the project directory |
| `projectCtx.config.configDir` | `string` | Absolute path to the directory containing `hal.config.json` |
| `projectCtx.config.dataDir` | `string` | Absolute path to user data storage root |
| `projectCtx.config.context` | `Record\<string, string\> \| undefined` | Raw config-level context values (pre-hook) |
| `projectCtx.logger` | Pino logger | Structured logger — use for debug output that ends up in log files |

### Examples

- [`examples/obsidian/.hal/commands/status.mjs`](examples/obsidian/.hal/commands/status.mjs) — project-specific command using `projectCtx.config`
- [`examples/.hal/commands/context.mjs`](examples/.hal/commands/context.mjs) — global command that dumps the full resolved context
- [`examples/.hal/commands/joke.mjs`](examples/.hal/commands/joke.mjs) — global command using `agent.call` with live status cycling and `onProgress` updates

### Skills

Skills follow the [Agent Skills standard](https://agentskills.io/). Each engine looks for skills in engine-specific directories (highest priority first):

| Engine       | Skill directories (priority order)                     |
|--------------|--------------------------------------------------------|
| Claude       | `.claude/skills`                                       |
| Codex        | `.agents/skills`                                       |
| Copilot      | `.agents/skills`, `.github/skills`, `.claude/skills`   |
| OpenCode     | `.agents/skills`, `.opencode/skills`, `.claude/skills` |
| Cursor       | `.agents/skills`, `.cursor/skills`                     |
| Antigravity  | `.agent/skills`                                        |

When the same skill name exists in multiple directories, the highest-priority directory wins (first-found). Each skill is a folder containing a `SKILL.md` file with a YAML frontmatter block and a prompt body:

```
{project-cwd}/
└── .agents/skills/       # or .claude/skills/, .github/skills/, etc.
    └── chuck/
        └── SKILL.md
```

```markdown
---
name: chuck
description: Tells a joke about Chuck Norris.
---

Tell a short, funny joke about Chuck Norris.
```

At boot time (and whenever `SKILL.md` files change) the bot reads every skill folder, parses the frontmatter, and registers the skills as Telegram slash commands via `setMyCommands`. The **folder name** is used as the command name — if the frontmatter `name` field differs from the folder name the bot logs a warning and uses the folder name.

When a user invokes a skill command (e.g. `/chuck`) the bot:
1. Reads the `SKILL.md` prompt body
2. Appends any user arguments as `User input: {args}` if present
3. Calls the AI engine with that prompt via the engine-agnostic `agent.call()` interface
4. Sends the response back to the user

Skills can be **overridden per-project**: create a `.hal/commands/{name}.mjs` file with the same name as the skill and the `.mjs` handler takes full precedence.

**Command precedence** (highest wins):

```
project .hal/commands/{name}.mjs  >  global .hal/commands/{name}.mjs  >  engine skills (see table above)
```

See [`examples/obsidian/.claude/skills/chuck/`](examples/obsidian/.claude/skills/chuck/SKILL.md) and [`examples/obsidian/.claude/skills/weather/`](examples/obsidian/.claude/skills/weather/SKILL.md) for example skills.


### Hot-reload

Commands and skills are **hot-reloaded** — drop a new `.mjs` file or `SKILL.md` into the relevant directory and the bot registers it with Telegram automatically, with no restart. This means the AI engine can write new command or skill files as part of a task and users see them in the `/` menu immediately.

## Creating a Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`
3. Choose a display name (e.g. "My Backend Assistant")
4. Choose a username ending in `bot` (e.g. `my_backend_assistant_bot`)
5. Add the token to `.env.local` and reference it via `${VAR_NAME}` in `hal.config.json`

For each project you need a separate bot and token.

## Finding Your Telegram User ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. It will reply with your numeric user ID
3. Add it to `allowedUserIds`

## Voice Messages

Voice messages are transcribed locally using [Whisper](https://github.com/openai/whisper) via the `nodejs-whisper` package. No audio is sent to external services.

### Setup

1. **ffmpeg** — for audio conversion
   ```bash
   brew install ffmpeg         # macOS
   sudo apt install ffmpeg     # Ubuntu/Debian
   ```

2. **CMake** — for building the Whisper executable
   ```bash
   brew install cmake          # macOS
   sudo apt install cmake      # Ubuntu/Debian
   ```

3. **Download and build Whisper** — run once after installation:
   ```bash
   npx nodejs-whisper download
   ```

### Whisper Models

| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| `tiny` | ~75 MB | Fastest | Basic |
| `tiny.en` | ~75 MB | Fastest | English-only |
| `base` | ~142 MB | Fast | Good |
| `base.en` | ~142 MB | Fast | English-only (default) |
| `small` | ~466 MB | Medium | Good multilingual |
| `medium` | ~1.5 GB | Slower | Very good multilingual |
| `large-v3-turbo` | ~1.5 GB | Fast | Near-large quality |

## Sending Files to Users

The engine can send files back through Telegram. Each user has a `downloads/` folder under their data directory. The engine is informed of this path in every prompt.

1. The engine writes a file to the downloads folder
2. The bot detects it after the engine's response completes
3. The file is sent via Telegram (as a document)
4. The file is deleted from the server after delivery

## Migration from v1 (Single-Project Config)

The old single-project config format is no longer supported. Migrate by wrapping your config:

**Before:**
```json
{
  "telegram": { "botToken": "..." },
  "access": { "allowedUserIds": [123] },
  "claude": { "command": "claude" },
  "logging": { "level": "info" }
}
```

**After:**
```json
{
  "globals": {
    "engine": { "name": "claude" },
    "logging": { "level": "info" }
  },
  "projects": [
    {
      "cwd": ".",
      "telegram": { "botToken": "..." },
      "access": { "allowedUserIds": [123] }
    }
  ]
}
```

> **Note:** Named environment variable overrides from v1 (`TELEGRAM_BOT_TOKEN`, `ALLOWED_USER_IDS`, etc.) are no longer supported. Use `${VAR_NAME}` substitution in `hal.config.json` instead — see [Configuration](docs/config/README.md#environment-variable-substitution).

## Security Notice

**Important**: Conversations with this bot are not end-to-end encrypted. Messages pass through Telegram's servers. Do not share:

- Passwords or API keys
- Personal identification numbers
- Financial information
- Confidential business data

This bot is intended for development assistance only. Treat all conversations as potentially visible to third parties.

## License

ISC
