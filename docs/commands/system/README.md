# System Commands

System commands are the HAL-managed commands exposed through config under `globals.commands` or `projects.<key>.commands`.

## Visibility and routing

Built-in HAL commands support three independent controls:

- `enabled` — whether HAL intercepts and handles the command
- `showInMenu` — whether the command appears in Telegram's slash-command menu
- `showInHelp` — whether the command appears in `${HAL_COMMANDS}`

These settings are config-driven and inherit from `globals.commands.*` into each project unless overridden.

## Defaults

The current defaults in code are:

| Command family | `enabled` | `showInMenu` | `showInHelp` |
|----------------|-----------|--------------|--------------|
| `/start` | `true` | `false` | `false` |
| `/help` | `true` | `true` | `true` |
| `/clear` | `true` | `true` | `true` |
| `/reset` | `false` | `true` | `true` |
| `/info` | `true` | `true` | `true` |
| `/model` | auto-enabled | `true` | `true` |
| `/engine` | auto-enabled | `true` | `true` |
| `/git_*` | `false` | `true` | `true` |
| npm-derived commands | `false` | `true` | `true` |

`/model` and `/engine` are runtime-dependent:

- `/model` is enabled only when the active engine has more than one model choice, or when self-discovery is available
- `/engine` is enabled only when more than one engine choice is available

## Per-command docs

- [start](start/README.md)
- [help](help/README.md)
- [clear](clear/README.md)
- [reset](reset/README.md)
- [info](info/README.md)
- [model](model/README.md)
- [engine](engine/README.md)
- [git](git/README.md)
- [npm](npm/README.md)

## Configuration

For the config schema and examples, see [Built-in commands configuration](../../config/commands/README.md).
