# Project Commands

Project commands are custom `.mjs` slash commands loaded from:

- `{project.cwd}/.hal/commands/{name}.mjs`
- `{configDir}/.hal/commands/{name}.mjs` for global shared commands

Project-local commands take precedence over global commands with the same name.

## What a project command is

A project command is a JavaScript module that HAL loads dynamically when a user sends a matching slash command.

If the file is:

```text
{project.cwd}/.hal/commands/status.mjs
```

the Telegram command name is:

```text
/status
```

The filename is the command name:

- strip the `.mjs` extension
- use lowercase letters, digits, and underscores only
- command names must match Telegram's command rules: `[a-z0-9_]{1,32}`

## Resolution and precedence

HAL resolves slash commands in this order:

1. enabled built-in HAL commands
2. project `.mjs` commands
3. global `.mjs` commands
4. skills with `telegram: true`
5. the AI engine

Implications:

- a project command overrides a global command with the same name
- a project/global `.mjs` command overrides a same-name skill
- a disabled built-in command no longer blocks a same-name project command
- if no command or skill matches, HAL forwards the raw slash-command text to the engine

## Current exposure model

Custom `.mjs` commands are currently:

- discovered by filename
- required to export `description`
- shown in Telegram menu and `${HAL_COMMANDS}` by default

Unlike built-in HAL commands, they do not yet have a file-level `showInMenu` / `showInHelp` signature.

## Required exports

Each file must export:

- `description`
- a default handler

Optional:

- `callbackHandler`

Minimal example:

```js
export const description = "Show project status";

export default async function ({ projectCtx }) {
  return {
    type: "assistant",
    message: `Project: ${projectCtx.config.name}`,
  };
}
```

## `description`

`description` is required and is used in:

- the Telegram slash-command menu
- `${HAL_COMMANDS}`

Rules:

- must be a non-empty string
- should fit Telegram's 256-character command description limit
- should describe the command in one short sentence

## Default handler signature

The default export is an async function called when the slash command matches:

```js
export default async function handler({
  args,
  ctx,
  gram,
  agent,
  projectCtx,
}) {
  return { type: "assistant", message: "Done." };
}
```

The handler receives a single object with these properties.

### `args: string[]`

Whitespace-split arguments after the command name.

Examples:

```text
/deploy staging eu-west  ->  ["staging", "eu-west"]
/status                  ->  []
```

Typical use:

```js
if (!args[0]) {
  return { type: "assistant", message: "Usage: /deploy <env>" };
}
```

### `ctx: Record<string, string>`

The resolved runtime context map for this message.

This is the same context HAL would otherwise pass to the engine, including keys such as:

- `project.name`
- `project.cwd`
- `project.slug`
- `bot.userId`
- `bot.username`
- `bot.chatId`
- `bot.messageId`
- `sys.date`
- `sys.time`
- `sys.datetime`
- `engine.name`
- `engine.command`
- custom keys from `context:` config

Use `ctx` when the command needs lightweight access to resolved values without digging through the full project object.

### `gram: Grammy Context`

Direct Telegram context for replies, inline keyboards, callback answers, edits, and file sending.

Use `gram` when the command needs Telegram API control, for example:

- `gram.reply(...)`
- `gram.answerCallbackQuery(...)`
- `gram.api.editMessageText(...)`

### `agent`

The engine-agnostic agent interface created by HAL.

In most command implementations you do not need to call `agent` directly. The more common pattern is to return `{ type: "agent" }` or `{ type: "agent", message }` and let HAL continue through the normal engine path.

### `projectCtx`

The full HAL project runtime context, including:

- resolved config
- logger
- engine adapter
- boot context

Use `projectCtx` when the command needs access to the project config or deeper HAL runtime services.

Example:

```js
export default async function ({ projectCtx }) {
  const { config } = projectCtx;
  return {
    type: "assistant",
    message: `Project: ${config.name ?? config.slug}\nDirectory: ${config.cwd}`,
  };
}
```

This is the pattern used in [`status.mjs`](../../../examples/codex/.hal/commands/status.mjs).

## Return contract

The preferred handler return value is a typed result object.

Supported typed results:

- `{ type: "assistant", message }`
- `{ type: "agent" }`
- `{ type: "agent", message }`
- `{ type: "void" }`

### `{ type: "assistant", message }`

HAL sends `message` back to the user and stops routing.

Use this when the command already knows the final response.

```js
export default async function ({ projectCtx }) {
  return {
    type: "assistant",
    message: `Project: ${projectCtx.config.name}`,
  };
}
```

### `{ type: "agent" }`

HAL forwards the original full slash-command message unchanged to the engine.

If the user sends:

```text
/todo buy milk
```

the engine receives:

```text
/todo buy milk
```

Use this when the command wants the agent or a same-name skill to interpret the original command text.

### `{ type: "agent", message }`

HAL forwards the replacement `message` to the engine instead of the original slash-command text.

Use this when the command acts as a filter or prompt transformer.

```js
return {
  type: "agent",
  message: "Summarize the last 10 commits and group them by feature area.",
};
```

### `{ type: "void" }`

HAL stops routing and does nothing else.

Use this when the command manages the interaction itself through `gram` and optionally `callbackHandler`.

```js
export default async function ({ gram }) {
  await gram.reply("Done!");
  return { type: "void" };
}
```

## Legacy compatibility

Older command return styles still work during migration:

- `return "text"` behaves like `{ type: "assistant", message: "text" }`
- `return undefined`, `null`, `false`, `0`, or `""` behaves like `{ type: "agent" }`

HAL logs a warning for those legacy return values. New commands should use the typed result object only.

## `callbackHandler`

If the command renders inline keyboard buttons, it may also export:

```js
export async function callbackHandler({ data, gram, projectCtx }) {
  // handle callback data here
}
```

Use `callbackHandler` when the command needs interactive Telegram UI behavior such as:

- pagination
- message edits
- button-based selection flows

## Examples

### Example 1: simple direct-response command

```js
export const description = "Show project status";

export default async function ({ projectCtx }) {
  const { config } = projectCtx;
  return {
    type: "assistant",
    message: `Project: ${config.name ?? config.slug}\nDirectory: ${config.cwd}`,
  };
}
```

See [`status.mjs`](../../../examples/codex/.hal/commands/status.mjs).

### Example 2: context inspection command

```js
export const description = "Show context sent to the AI";

export default async function ({ ctx }) {
  const lines = Object.entries(ctx).map(([k, v]) => `${k}: ${v}`);
  return {
    type: "assistant",
    message: `*Context sent to AI (${lines.length} vars)*\n\`\`\`\n${lines.join("\n")}\n\`\`\``,
  };
}
```

See [`context.mjs`](../../../examples/.hal/commands/context.mjs).

### Example 3: hybrid command that sometimes yields to the engine

This pattern is useful when the no-argument case is deterministic but argument-bearing input should go to the agent.

```js
export default async function ({ args, gram, projectCtx }) {
  if (args.length > 0) {
    return { type: "agent" };
  }

  await gram.reply("Showing the first page of TODOs...");
  return { type: "void" };
}
```

See [`todo.mjs`](../../../examples/codex/.hal/commands/todo.mjs).

## Error behavior

If the command throws an error, HAL logs it and replies with:

```text
Command failed: ...
```

Malformed typed return values are treated as command errors. For example:

- `{ type: "assistant" }`
- `{ type: "agent", message: "" }`
- `{ type: "void", message: "ignored" }`

## Hot reload

Commands are watched and reloaded automatically.

When a `.mjs` file is added, changed, or removed:

- HAL reloads the command module
- Telegram command registration is refreshed
- no bot restart is required

## Current limitations

Project `.mjs` commands do not yet have a file-level visibility signature. At the moment:

- command discovery is implicit by filename
- menu/help exposure is implicit when `description` exists
- there is no per-command `showInMenu` or `showInHelp` in the file itself

That visibility model is a possible future extension, but it is not part of the current command authoring contract.
