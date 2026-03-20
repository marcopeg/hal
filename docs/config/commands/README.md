# Built-in commands configuration

Customize built-in command behavior and toggle individual commands on/off. The `commands` key can be set under `globals` (shared default for all projects) or per project (overrides globals). Project-level settings take precedence.

Configure this in [Configuration](../README.md) via `globals.commands` or per-project in the `projects` map (e.g. `projects.<key>.commands`).

## Routing vs. visibility

Two separate concerns are configured independently:

- **`enabled`** — whether HAL intercepts and handles the command. When `false`, the command is not routed to HAL; slash messages fall through to project custom commands, global custom commands, skills, and finally the agent.
- **`showInMenu`** — whether the command appears in the Telegram slash-command menu published via `setMyCommands`.
- **`showInHelp`** — whether the command appears in the `${HAL_COMMANDS}` placeholder used by `/start`, `/help`, and other message templates.

These flags can be combined freely. For example, `/start` is `enabled: true` (HAL intercepts it) but `showInMenu: false` and `showInHelp: false` (it is not listed anywhere) — the default for most bots.

## Default built-in behavior

| Command | `enabled` | `showInMenu` | `showInHelp` |
|---------|-----------|--------------|--------------|
| `/start` | `true` | `false` | `false` |
| `/help` | `true` | `true` | `true` |
| `/clear` | `true` | `true` | `true` |
| `/reset` | `false` | `true` | `true` |
| `/info` | `true` | `true` | `true` |
| `/model` | auto* | `true` | `true` |
| `/engine` | auto* | `true` | `true` |
| `/git_*` | `false` | `true` | `true` |
| `npm` scripts | `false` | `true` | `true` |

\* `/model` and `/engine` are auto-enabled when the `providers` config has more than one model/engine choice. The `enabled` flag can explicitly disable them regardless.

## Configuring commands

```yaml
commands:
  model:
    enabled: true
    showInMenu: true
    showInHelp: true
  engine:
    enabled: true
  git:
    enabled: true
  start:
    enabled: true
    showInMenu: false  # hidden from Telegram menu and help by default
    showInHelp: false
  help:
    enabled: true
  reset:
    enabled: false    # disabled by default
    showInMenu: true
    showInHelp: true
  clear:
    enabled: true
  info:
    enabled: true
    cwd: true
    engineModel: true
    session: true
    context: true
  npm:
    enabled: false
    showInMenu: true
    showInHelp: true
    whitelist: ["build", "test"]
    blacklist: ["start"]
    timeoutMs: 60000
    maxOutputChars: 4000
    sendAsFileWhenLarge: true
```

## Custom messages

The `/start`, `/help`, `/reset`, and `/clear` commands additionally support a custom `message`:

```yaml
globals:
  commands:
    start:
      session:
        reset: true
      message:
        text: "Welcome, ${bot.firstName}!"
    help:
      message:
        from: "./HELP.md"
    reset:
      session:
        reset: true
      timeout: 120
      message:
        confirm: "This will erase everything. Proceed?"
        done: "All wiped!"
    clear:
      message:
        text: "Session reset. Ready for a new conversation."
```

Each command supports a `message` object with **exactly one** of:

| Field | Description |
|-------|-------------|
| `message.text` | Inline message string |
| `message.from` | Path to a file (relative to project `cwd`) whose content is used as the message |

Setting both `text` and `from`, or neither, is a configuration error.

Detailed per-command behavior lives under [Commands → System commands](../../commands/system/README.md).

## /start

The `/start` command additionally supports `session.reset` (boolean, default `false`). When `true`, the session is reset after sending the welcome message (same effect as `/clear`).

## /reset

The `/reset` command is **disabled by default** (`enabled: false`). Enable it explicitly when needed. When enabled, it asks for confirmation before deleting user data. It sends an inline keyboard with **Yes, go ahead!** and **Abort!** buttons. The prompt auto-expires after `timeout` seconds (default `60`), removing the buttons. Sending `/reset` again while a prompt is active invalidates the previous one.

| Field | Description | Default |
|-------|-------------|---------|
| `session.reset` | Also reset the LLM session after wiping data | `false` |
| `timeout` | Seconds before the confirmation prompt auto-expires | `60` |
| `message.confirm` | Custom confirmation prompt text | `"This is going to delete the user data folder. Are you sure?"` |
| `message.done` | Custom message shown after successful reset | `"done!"` |

## /clear

The `/clear` command always resets the LLM session regardless of configuration — user files (uploads, downloads) are preserved. The custom message only changes what the user sees afterward.

Only `commands.clear` is supported. `commands.clean` is invalid and causes a configuration error.

## /info

The `/info` command shows current runtime information for the project.

- Message 1: summary section (always includes project name; optionally includes CWD, engine/model, session mode)
- Message 2: resolved context key-value pairs in a fenced code block (when enabled)

When context output is too large for one Telegram message, HAL splits it into multiple fenced code-block messages.

| Field | Description | Default |
|-------|-------------|---------|
| `enabled` | Enable the `/info` command | `true` |
| `cwd` | Include CWD in summary output | `true` |
| `engineModel` | Include current engine and model in summary output | `true` |
| `session` | Include session mode (`true`, `false`, `shared`, `user`) in summary output | `true` |
| `context` | Send resolved context as a second code-block message | `true` |

When `enabled: false`, `/info` is not intercepted by HAL. The slash command falls through to project custom commands, global custom commands, skills, and finally the agent — same as any other disabled built-in.

Note: env/source-aware redaction for context values is not implemented in this task iteration.

## /model

The `/model` command lets users switch the AI model for the current engine.

- `/model` (no argument) — shows the current model, the default (if configured), and an inline keyboard with all available models from the `providers` config.
- `/model <name>` — validates the name against the configured model list and writes the change to the config file.
- When no `providers` list is configured for the active engine, `/model` shows only the current value and accepts any model name.

**Auto-disable:** `/model` is **automatically hidden** from the bot when the active engine's `providers` list has zero or one entries. The `enabled` flag in config can still explicitly disable it regardless of the list size.

## /engine

The `/engine` command lets users switch the AI engine for the current project. Switching engines also clears the model selection (since models are engine-specific).

- `/engine` (no argument) — shows the current engine (and model), and an inline keyboard with all available engines derived from the `providers` config keys.
- `/engine <name>` — validates the name against the configured engines and writes the change to the config file.

**Auto-disable:** `/engine` is **automatically hidden** from the bot when only zero or one engines have model lists defined in `providers`. The `enabled` flag in config can still explicitly disable it regardless.

## /npm

The `commands.npm` entry controls a derived npm command surface based on the project's `package.json` scripts. It is **disabled by default** (`enabled: false`).

When enabled, HAL reads `package.json`, applies whitelist/blacklist filtering, and exposes each allowed script as an individual Telegram slash command (using the sanitized script name). These entries appear in both the Telegram menu and `${HAL_COMMANDS}` by default.

The `/npm` launcher command remains available for direct use (`/npm` with no argument shows a script-picker keyboard; `/npm <script>` runs a script directly). However, individual script commands take precedence in the menu and help output.

Clicking an individual npm script entry in the Telegram menu sends the script name as a slash command. The text handler routes it back to the npm executor automatically — no separate bot handler is registered per script.

If `package.json` does not exist or has no scripts, npm script entries are silently omitted from menu and help. A runtime error is shown only when a user actively invokes `/npm`.

| Field | Description | Default |
|-------|-------------|---------|
| `enabled` | Enable npm script handling | `false` |
| `showInMenu` | Show npm-derived script entries in the Telegram menu | `true` |
| `showInHelp` | Show npm-derived script entries in `${HAL_COMMANDS}` | `true` |
| `whitelist` | Array of allowed script names. If set, only these scripts are exposed. | `undefined` |
| `blacklist` | Array of forbidden script names. These scripts are hidden and blocked. | `undefined` |
| `timeoutMs` | Maximum execution time in milliseconds before the script is killed | `60000` |
| `maxOutputChars` | Maximum characters of log output to send in the Telegram message | `4000` |
| `sendAsFileWhenLarge` | If `true` and output exceeds `maxOutputChars`, sends the full log as a document | `true` |

When `whitelist` is provided, only scripts in the whitelist (that also exist in `package.json`) are exposed. When `blacklist` is provided, those scripts are removed from the available list.

## Default messages

When no `commands` config is set:

| Command | Default message |
|---------|-----------------|
| `/start` | `Welcome to ${project.name}!` followed by the command list |
| `/help` | The command list |
| `/reset` | Confirmation prompt: `"This is going to delete the user data folder. Are you sure?"`, then `"done!"` on confirm |
| `/clear` | `Session reset. Your next message starts a new conversation.` |
| `/info` | Summary info, plus context in a separate code block message (when `commands.info.context: true`) |

Messages are sent with Telegram's legacy Markdown formatting. Supported syntax: `*bold*`, `_italic_`, `` `inline code` ``, ` ```code blocks``` `, `[link text](url)`.

## Variable substitution in command messages

All `message.text` values and file contents from `message.from` support:

| Pattern | Description |
|---------|-------------|
| `${varName}` | Implicit context (`bot.firstName`, `sys.date`, `project.name`, etc.) and env vars |
| `@{cmd}` | Message-time shell command |

The special **`${HAL_COMMANDS}`** placeholder expands to a formatted list of all available commands, divided into five sections (empty sections are omitted). It uses `showInHelp` visibility independently from the Telegram menu (`showInMenu`):

- **Project Commands** — `.mjs` commands from the project's `.hal/commands/` directory
- **Project Skills** — engine skills marked with `telegram: true` in their `SKILL.md` frontmatter
- **System Commands** — `.mjs` commands from the global `.hal/commands/` directory (shared across projects)
- **Hal Commands** — built-in commands with `showInHelp: true` (e.g. `/help`, `/clear`, `/info`, `/model`, `/engine`; `/start` and `/reset` are hidden by default)
- **Versioning** — git built-in commands (`/git_init`, `/git_status`, `/git_commit`, `/git_clean`) — only when `commands.git.enabled: true`

npm-derived script commands also appear under **Hal Commands** when `commands.npm.enabled: true` and `commands.npm.showInHelp: true`.

Example `WELCOME.md`:

```markdown
Welcome to ${project.name}, ${bot.firstName}!

${HAL_COMMANDS}
```

## Making skills visible in the command list

By default, skills are not listed in `${HAL_COMMANDS}` or in the Telegram slash command menu. Add `telegram: true` to a skill's frontmatter to include it in both:

```yaml
---
name: crm
description: Manage your contacts
telegram: true
---
```

The previous `public` frontmatter key is no longer used; only `telegram: true` controls Telegram exposure (no backward compatibility).

[System commands →](../../commands/system/README.md)

[Project commands →](../../commands/project/README.md)

[Skills →](../../commands/skills/README.md)

[← Back to Configuration](../README.md)
