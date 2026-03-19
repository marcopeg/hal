# `/info`

Shows runtime information for the active project.

## Defaults

- `enabled: true`
- `showInMenu: true`
- `showInHelp: true`
- `cwd: true`
- `engineModel: true`
- `session: true`
- `context: true`

## Behavior

`/info` can produce:

- a summary message with project/runtime details
- a second message with the resolved context map

When `enabled: false`, HAL does not intercept `/info`. The slash command falls through to project/global commands, then skills, then the agent.

See [Built-in commands configuration](../../../config/commands/README.md).
