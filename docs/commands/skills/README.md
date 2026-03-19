# Skills

Skills are prompt-based command handlers loaded from engine skill directories such as `.agents/skills/`.

## Current exposure model

Skills are engine-available by default, but they are exposed as Telegram slash commands only when the skill frontmatter includes:

```yaml
telegram: true
```

That flag currently controls both:

- Telegram slash-menu visibility
- `${HAL_COMMANDS}` visibility

Unlike built-in HAL commands, skills do not yet have separate `showInMenu` / `showInHelp` controls.

## Routing

Skills are reached only after HAL checks:

1. enabled built-ins
2. project `.mjs` commands
3. global `.mjs` commands

A same-name `.mjs` command overrides the skill at slash-command routing time.

## Authoring

Every skill lives in its own folder and contains `SKILL.md` with frontmatter plus a prompt body.

Minimum useful frontmatter:

```markdown
---
name: todo
title: TODO Manager
description: Read and update the project TODO list stored in TODOS.md.
telegram: true
---
```

For the full authoring guide, see this page together with the [Commands index](../README.md).
