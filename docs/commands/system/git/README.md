# `git_*`

HAL exposes four git helper commands when git command handling is enabled:

- `/git_init`
- `/git_status`
- `/git_commit`
- `/git_clean`

## Defaults

- `enabled: false`
- `showInMenu: true`
- `showInHelp: true`

The single `commands.git` config entry controls all four git commands together.

See [Built-in commands configuration](../../../config/commands/README.md).
