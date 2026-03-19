# Commands

HAL exposes three command surfaces:

- [System commands](system/README.md) — built-in HAL commands such as `/start`, `/help`, `/clear`, `/info`, `/model`, `/engine`, git helpers, and npm-derived script commands.
- [Project commands](project/README.md) — custom `.mjs` slash commands loaded from `.hal/commands/`.
- [Skills](skills/README.md) — `SKILL.md` prompt commands loaded from engine skill directories.

## Routing order

Slash-command routing currently works like this:

1. Enabled built-in HAL commands
2. Project custom `.mjs` commands
3. Global custom `.mjs` commands
4. Skills with `telegram: true`
5. Fallback to the AI engine

When a built-in command is disabled, HAL does not intercept it. The message falls through to lower-precedence custom commands, then skills, then the agent.

## Visibility model

Visibility is not yet uniform across all three surfaces:

- Built-in HAL commands use `enabled`, `showInMenu`, and `showInHelp`
- npm-derived commands are controlled through `commands.npm.*`
- Skills use `telegram: true`
- Custom `.mjs` commands are auto-exposed by discovery and `description`

See the pages below for the exact behavior of each surface.
