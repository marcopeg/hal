# Built-in commands configuration

Customize built-in command behavior and toggle individual commands on/off. The `commands` key can be set under `globals` (shared default for all projects) or per project (overrides globals). Project-level settings take precedence.

Configure this in [Configuration](../README.md) via `globals.commands` or `projects[].commands`.

## Enabling commands

Each command supports an `enabled` flag (default `true` for most, `false` for `/git`):

```json
{
  "commands": {
    "model": { "enabled": true },
    "git": { "enabled": true },
    "start": { "enabled": true },
    "help": { "enabled": true },
    "reset": { "enabled": true },
    "clean": { "enabled": true }
  }
}
```

## Custom messages

The `/start`, `/help`, `/reset`, and `/clean` commands additionally support a custom `message`:

```json
{
  "globals": {
    "commands": {
      "start": {
        "session": { "reset": true },
        "message": { "text": "Welcome, ${bot.firstName}!" }
      },
      "help": {
        "message": { "from": "./HELP.md" }
      },
      "reset": {
        "session": { "reset": true },
        "timeout": 120,
        "message": {
          "confirm": "This will erase everything. Proceed?",
          "done": "All wiped!"
        }
      },
      "clean": {
        "message": { "text": "Session reset. Ready for a new conversation." }
      }
    }
  }
}
```

Each command supports a `message` object with **exactly one** of:

| Field | Description |
|-------|-------------|
| `message.text` | Inline message string |
| `message.from` | Path to a file (relative to project `cwd`) whose content is used as the message |

Setting both `text` and `from`, or neither, is a configuration error.

## /start

The `/start` command additionally supports `session.reset` (boolean, default `false`). When `true`, the session is reset after sending the welcome message (same effect as `/clean`).

## /reset

The `/reset` command asks for confirmation before deleting user data. It sends an inline keyboard with **Yes, go ahead!** and **Abort!** buttons. The prompt auto-expires after `timeout` seconds (default `60`), removing the buttons. Sending `/reset` again while a prompt is active invalidates the previous one.

| Field | Description | Default |
|-------|-------------|---------|
| `session.reset` | Also reset the LLM session after wiping data | `false` |
| `timeout` | Seconds before the confirmation prompt auto-expires | `60` |
| `message.confirm` | Custom confirmation prompt text | `"This is going to delete the user data folder. Are you sure?"` |
| `message.done` | Custom message shown after successful reset | `"done!"` |

## /clean

The `/clean` command always resets the LLM session regardless of configuration — user files (uploads, downloads) are preserved. The custom message only changes what the user sees afterward.

## Default messages

When no `commands` config is set:

| Command | Default message |
|---------|-----------------|
| `/start` | `Welcome to ${project.name}!` followed by the command list |
| `/help` | The command list |
| `/reset` | Confirmation prompt: `"This is going to delete the user data folder. Are you sure?"`, then `"done!"` on confirm |
| `/clean` | `Session reset. Your next message starts a new conversation.` |

Messages are sent with Telegram's legacy Markdown formatting. Supported syntax: `*bold*`, `_italic_`, `` `inline code` ``, ` ```code blocks``` `, `[link text](url)`.

## Variable substitution in command messages

All `message.text` values and file contents from `message.from` support:

| Pattern | Description |
|---------|-------------|
| `${varName}` | Implicit context (`bot.firstName`, `sys.date`, `project.name`, etc.) and env vars |
| `@{cmd}` | Message-time shell command |

The special **`${HAL_COMMANDS}`** placeholder expands to a formatted list of all available commands, divided into five sections (empty sections are omitted):

- **Project Commands** — `.mjs` commands from the project's `.hal/commands/` directory
- **Project Skills** — engine skills marked with `public: true` in their `SKILL.md` frontmatter
- **System Commands** — `.mjs` commands from the global `.hal/commands/` directory (shared across projects)
- **Hal Commands** — built-in commands (`/start`, `/help`, `/reset`, `/clean`, `/model`)
- **Versioning** — git built-in commands (`/git_init`, `/git_status`, `/git_commit`, `/git_clean`) — only when `commands.git.enabled: true`

Example `WELCOME.md`:

```markdown
Welcome to ${project.name}, ${bot.firstName}!

${HAL_COMMANDS}
```

## Making skills visible in the command list

By default, skills are not listed in `${HAL_COMMANDS}`. Add `public: true` to a skill's frontmatter to include it:

```yaml
---
name: crm
description: Manage your contacts
public: true
---
```

[← Back to Configuration](../README.md)
