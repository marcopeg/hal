# `/reset`

Deletes user data after confirmation and can also reset the active LLM session.

## Defaults

- `enabled: false`
- `showInMenu: true`
- `showInHelp: true`

`/reset` is disabled by default and must be explicitly enabled.

## Config

Supported keys:

- `enabled`
- `showInMenu`
- `showInHelp`
- `session.reset`
- `message.confirm`
- `message.done`
- `timeout`

When enabled, HAL shows a confirmation inline keyboard and auto-expires it after `timeout` seconds.

See [Built-in commands configuration](../../../config/commands/README.md).
