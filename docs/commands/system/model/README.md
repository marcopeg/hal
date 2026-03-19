# `/model`

Lets the user inspect or switch the current engine model.

## Defaults

- `enabled: true` in config, but runtime-gated
- `showInMenu: true`
- `showInHelp: true`

## Runtime gating

`/model` is only actually enabled when:

- the active engine has more than one configured model, or
- the engine supports runtime model self-discovery and the CLI is available

If those conditions are not met, HAL does not register `/model`.

See [Built-in commands configuration](../../../config/commands/README.md).
