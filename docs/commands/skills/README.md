# Skills

Skills are prompt-based command handlers loaded from engine skill directories such as `.agents/skills/`.

## Telegram exposure model

Skills are engine-available by default. Telegram exposure is controlled by the `telegram` frontmatter key:

```yaml
telegram: true
```

This is shorthand for:

- `enabled: true`
- `showInMenu: true`
- `showInHelp: true`

You can also disable Telegram exposure explicitly:

```yaml
telegram: false
```

Or use the object form:

```yaml
telegram:
  enabled: true
  showInMenu: false
  showInHelp: true
```

Defaults in object form:

- omitted fields default to `true`
- omitting `telegram` entirely keeps the skill engine-only

Invalid Telegram metadata is fatal at boot/reload time. Supported values are only:

- `true`
- `false`
- an object with boolean `enabled`, `showInMenu`, and `showInHelp` keys only

## Routing

Skills are reached only after HAL checks:

1. enabled built-ins
2. project `.mjs` commands
3. global `.mjs` commands

An enabled same-name `.mjs` command overrides the skill at slash-command routing time.
If the same-name command exists but exports `enabled: false`, HAL falls through and the skill can become the active Telegram surface again.

## Authoring

Every skill lives in its own folder and contains `SKILL.md` with frontmatter plus a prompt body.

Minimum useful frontmatter:

```markdown
---
name: todo
title: TODO Manager
description: Read and update the project TODO list stored in TODOS.md.
telegram:
  enabled: true
  showInMenu: true
  showInHelp: true
---
```

For the full authoring guide, see this page together with the [Commands index](../README.md).
