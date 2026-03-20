# `/start`

Telegram-native welcome command handled by HAL.

## Defaults

- `enabled: true`
- `showInMenu: false`
- `showInHelp: false`

`/start` is intentionally handled by HAL by default while staying hidden from both the Telegram menu and `${HAL_COMMANDS}`.

## Config

Supported keys:

- `enabled`
- `showInMenu`
- `showInHelp`
- `session.reset`
- `message`

`session.reset: true` makes `/start` reset the session before sending the welcome message.

`message` supports either:

- `message.text`
- `message.from`

See [Built-in commands configuration](../../../config/commands/README.md).
