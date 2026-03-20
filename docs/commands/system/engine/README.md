# `/engine`

Lets the user inspect or switch the current project engine.

## Defaults

- `enabled: true` in config, but runtime-gated
- `showInMenu: true`
- `showInHelp: true`

## Runtime gating

`/engine` is only actually enabled when more than one engine choice is available.

If not, HAL does not register `/engine`.

See [Built-in commands configuration](../../../config/commands/README.md).
