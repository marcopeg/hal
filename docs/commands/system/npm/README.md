# npm-derived commands

HAL can derive slash commands from the project's `package.json` scripts.

## Defaults

- `enabled: false`
- `showInMenu: true`
- `showInHelp: true`

When enabled, HAL:

- reads `package.json`
- applies whitelist/blacklist filtering
- exposes each allowed script as an individual slash command using a sanitized command name

The `/npm` launcher still exists for direct use, but the derived script entries are what appear in menu/help.

## Config

Supported keys:

- `enabled`
- `showInMenu`
- `showInHelp`
- `whitelist`
- `blacklist`
- `timeoutMs`
- `maxOutputChars`
- `sendAsFileWhenLarge`

See [Built-in commands configuration](../../../config/commands/README.md).
