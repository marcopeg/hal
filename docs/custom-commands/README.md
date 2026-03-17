# Custom commands

You can add your own slash commands as `.mjs` files. When a user sends `/mycommand`, the bot looks for a matching file before passing the message to the AI engine.

## File locations

| Location | Scope |
|----------|-------|
| `{project.cwd}/.hal/commands/{name}.mjs` | Project-specific |
| `{configDir}/.hal/commands/{name}.mjs` | Global — available to all projects |

Project-specific commands take precedence over global ones on name collision.

## How command resolution works

Slash commands are resolved in this order:

1. **Enabled built-in commands** (e.g. `/start`, `/help`, `/engine`, `/model`, `/clear`, `/info`, and `git_*`) are handled directly by the bot when `enabled: true`. Disabled built-ins are skipped at this step and do not block lower-precedence handlers.
2. **Project custom `.mjs` commands** — `{project.cwd}/.hal/commands/{name}.mjs`.
3. **Global custom `.mjs` commands** — `{configDir}/.hal/commands/{name}.mjs`.
4. **Skills** with `telegram: true` in `SKILL.md`.
5. **Fallback to the AI engine** when no command or skill matches.

When a built-in is **disabled** (`enabled: false`), a same-name project custom command, global custom command, or skill can intercept it instead. Only when none of those match does the slash command text reach the agent.

Custom command files can shadow skills with the same name. If you want a custom command to be reachable, avoid naming it after an **enabled** built-in command.

## Command file format

```js
// .hal/commands/deploy.mjs
export const description = 'Deploy the project'; // shown in Telegram's / menu

export default async function({ args, ctx, projectCtx }) {
  const env = args[0] ?? 'staging';
  return { type: 'assistant', message: `Deploying to ${env}...` };
}
```

The only required export is `description` (shown in Telegram's `/` suggestion menu) and a `default` function.

## Return contract

The preferred return value is a typed result object:

```js
return { type: 'assistant', message: 'Done.' };
return { type: 'agent' };
return { type: 'agent', message: 'Summarize the latest 10 commits by feature area.' };
return { type: 'void' };
```

Supported typed results:

- `{ type: 'assistant', message: string }`
  HAL sends `message` back to the user.
- `{ type: 'agent', message?: string }`
  HAL forwards the message to the AI engine.
  If `message` is omitted, HAL forwards the original full slash command unchanged.
  If `message` is provided, HAL forwards that replacement message instead.
- `{ type: 'void' }`
  HAL does nothing further for that message.
  Use this when your command manages its own replies, buttons, or callbacks.

Legacy compatibility is still supported during migration:

- returning a raw string behaves like `{ type: 'assistant', message }` and logs a warning
- returning `undefined`, `null`, `false`, `0`, `''`, or another falsy non-object behaves like `{ type: 'agent' }` and logs a warning

Malformed typed objects are treated as command errors. For example, `{ type: 'assistant' }` without a message fails instead of silently falling back.

## Choosing the right return type

Use the typed result as a routing decision:

| Return | Use it when | HAL does |
|--------|-------------|----------|
| `{ type: 'assistant', message }` | Your command already knows the final reply | Sends `message` to Telegram |
| `{ type: 'agent' }` | Your command wants the AI engine to handle the original slash command | Forwards the original full user message, including `/command ...` |
| `{ type: 'agent', message }` | Your command wants to reshape or expand the prompt before handing off to the AI | Forwards the replacement `message` to the engine |
| `{ type: 'void' }` | Your command is fully managing its own UI or flow with `gram` and/or callbacks | Stops routing and does nothing else |

This is the main mental model:

- `assistant` = "I handled this. Reply with this text."
- `agent` = "I matched this command, but let the engine continue from here."
- `void` = "I handled this interaction myself. HAL should stop."

## Hybrid command + skill pattern

The new contract is especially useful when a command should be partly deterministic and partly AI-driven.

Example: a project has both:

- a Telegram-visible skill named `todo`
- a custom command `.hal/commands/todo.mjs`

That command can split behavior by arguments:

```js
export default async function ({ args, gram }) {
  if (args.length > 0) {
    // Let the engine continue with the original /todo ... message.
    return { type: 'agent' };
  }

  await gram.reply('Showing the first page of TODOs...');
  return { type: 'void' };
}
```

Important routing detail:

- Once HAL matches a custom `.mjs` command, that command owns the routing decision.
- If the command returns `{ type: 'agent' }`, HAL forwards directly to the engine path.
- HAL does **not** bounce back into the direct Telegram skill shortcut for the same slash command.

This lets a command act like a filter in front of the engine:

- deterministic path for no-argument or UI-driven use cases
- AI path for natural-language requests

## Engine forwarding semantics

`{ type: 'agent' }` and `{ type: 'agent', message }` are similar, but not identical:

### `{ type: 'agent' }`

HAL forwards the original user message exactly as received.

If the user sent:

```text
/todo buy milk
```

the engine receives:

```text
/todo buy milk
```

This is the best option when you want the engine or a same-name skill to interpret the original command naturally.

### `{ type: 'agent', message }`

HAL forwards the replacement message instead.

```js
return {
  type: 'agent',
  message: 'Summarize the last 10 commits and group them by feature area.',
};
```

Use this when your command wants to:

- normalize shorthand input
- expand flags into a richer prompt
- inject deterministic context before the engine runs

## `void` and callback-driven commands

Use `{ type: 'void' }` when the command is doing its own Telegram work:

- sending one or more custom replies with `gram.reply()`
- editing messages directly
- rendering inline keyboards
- relying on a `callbackHandler`

Typical pattern:

```js
export async function callbackHandler({ data, gram }) {
  if (data === 'todo:next') {
    await gram.answerCallbackQuery();
    await gram.api.editMessageText(gram.chat.id, gram.callbackQuery.message.message_id, 'Next page');
  }
}

export default async function ({ gram }) {
  await gram.reply('Pick an option');
  return { type: 'void' };
}
```

Use `void` instead of legacy `null` / `undefined` when the command is intentionally self-managed.

## Migration from the legacy contract

Older commands may still do one of these:

```js
return 'Done';
return undefined;
return null;
```

These still work for compatibility, but they are no longer the contract you should author against:

- `string` → treated as `{ type: 'assistant', message }` with a warning
- falsy non-object (`undefined`, `null`, `false`, `0`, `''`, etc.) → treated as `{ type: 'agent' }` with a warning

Recommended rewrites:

```js
// Old
return 'Done';
// New
return { type: 'assistant', message: 'Done' };

// Old
return undefined;
// New
return { type: 'agent' };

// Old
await gram.reply('Done');
return null;
// New
await gram.reply('Done');
return { type: 'void' };
```

## Error behavior

Typed results are validated strictly enough to catch authoring mistakes early.

These are errors:

- `{ type: 'assistant' }` without a non-empty `message`
- `{ type: 'agent', message: '' }`
- `{ type: 'void', message: 'ignored' }`
- `{ type: 'something-else' }`
- truthy non-object values such as `123`

When this happens, HAL treats it as a command failure and replies with `Command failed: ...`.

## Handler arguments

### `args: string[]`

Tokens following the command name, split on whitespace.

```
/deploy staging eu-west  →  args = ['staging', 'eu-west']
/status                  →  args = []
```

### `ctx: Record<string, string>`

The fully-resolved context that would be sent to the AI for this message — identical to what the engine sees in its `# Context` header. Includes all implicit keys plus any config vars and hook results:

| Key group | Description |
|-----------|-------------|
| `bot.*` | `bot.userId`, `bot.username`, `bot.firstName`, `bot.chatId`, `bot.messageId`, `bot.timestamp`, `bot.datetime`, `bot.messageType` |
| `sys.*` | `sys.date`, `sys.time`, `sys.datetime`, `sys.ts`, `sys.tz` |
| `project.*` | `project.name`, `project.cwd`, `project.slug` (legacy) |
| `engine.*` | `engine.name`, `engine.command`, `engine.model` (if set), `engine.defaultModel` (if HAL default applied) |
| custom | Any keys defined in `context` config blocks, after `${}` / `#{}` / `@{}` substitution and context hook transforms |

Use `/context` (the built-in global command) to inspect the exact keys available at runtime.

### `gram: Grammy Context`

The raw [Grammy](https://grammy.dev) message context, giving direct access to the Telegram Bot API. Only needed for advanced use cases: sending multiple messages, editing or deleting messages, uploading files, reacting to messages, etc.

Common patterns:

```js
// Send a temporary status message, then delete it
const status = await gram.reply('Working...');
// ... do work ...
await gram.api.deleteMessage(gram.chat.id, status.message_id);

// Edit the status message while working
await gram.api.editMessageText(gram.chat.id, status.message_id, 'Still working...');

// React to the original message
await gram.react([{ type: 'emoji', emoji: '👍' }]);

// Send a file
await gram.replyWithDocument(new InputFile('/path/to/file.pdf'));
```

When using `gram` to fully manage the interaction yourself, return `{ type: 'void' }`:

```js
export default async function({ gram }) {
  await gram.reply('Done!');
  return { type: 'void' };
}
```

### `agent: Agent`

An engine-agnostic interface for making one-shot AI calls from within a command. The underlying engine is configured per-project. Command handlers always use this interface and never talk to any engine directly.

```ts
interface Agent {
  call(
    prompt: string,
    options?: { onProgress?: (message: string) => void }
  ): Promise<string>;
}
```

Unlike regular user messages, agent calls have no session history and no context header prepended — the prompt is sent to the engine as-is.

| Option | Type | Description |
|--------|------|-------------|
| `onProgress` | `(message: string) => void` | Called during execution with activity updates (e.g. `"Reading: /path/to/file"`). Use it to keep the user informed while the agent is working. |

Returns the agent's final text output as a string. Throws on failure — the bot's command error handler will catch it and reply with `Command failed: {message}`.

## Callback routing (inline buttons)

If your command renders an inline keyboard, set the callback data to start with your command name and a colon (for example: `deploy:confirm`). HAL routes callbacks in this order:

1. **Built-in handlers** for reserved prefixes:
   - `en:` (engine picker)
   - `md:` (model picker)
   - `r:` (reset confirmation)
   - `gc:` (git clean confirmations)
   - `npm:` (npm script picker)
2. **Generic `.mjs` dispatcher** for `commandName:` prefixes

To handle your own callbacks, export a `callbackHandler` from the command file:

```js
export async function callbackHandler({ data, gram, projectCtx }) {
  if (data === 'deploy:confirm') {
    await gram.answerCallbackQuery('Deploying...');
    // ... run your work ...
  }
}
```

```js
export default async function({ args, gram, agent }) {
  const status = await gram.reply('Thinking...');

  const answer = await agent.call(`Summarise: ${args.join(' ')}`, {
    onProgress: async (activity) => {
      try {
        await gram.api.editMessageText(gram.chat.id, status.message_id, `⏳ ${activity}`);
      } catch { /* ignore if message was already edited */ }
    },
  });

  await gram.api.deleteMessage(gram.chat.id, status.message_id);
  return answer;
}
```

See [`examples/.hal/commands/joke.mjs`](../../examples/.hal/commands/joke.mjs) for a full example that combines `gram` for live status cycling with `agent.call` + `onProgress` for activity updates.

### `projectCtx: ProjectContext`

The project-level context object. Useful fields:

| Field | Type | Description |
|-------|------|-------------|
| `projectCtx.config.name` | `string \| undefined` | Project name from config |
| `projectCtx.config.slug` | `string` | Project key (legacy field name: `slug`, used for log/data paths) |
| `projectCtx.config.cwd` | `string` | Absolute path to the project directory |
| `projectCtx.config.configDir` | `string` | Absolute path to the directory containing the config file (e.g. `hal.config.yaml`) |
| `projectCtx.config.dataDir` | `string` | Absolute path to user data storage root |
| `projectCtx.config.context` | `Record<string, string> \| undefined` | Raw config-level context values (pre-hook) |
| `projectCtx.logger` | Pino logger | Structured logger — use for debug output that ends up in log files |

## Examples

### Direct assistant reply

```js
export default async function ({ args }) {
  const env = args[0] ?? 'staging';
  return { type: 'assistant', message: `Deploying to ${env}...` };
}
```

### Forward the original slash command to the engine

```js
export default async function ({ args }) {
  if (args.length === 0) {
    return { type: 'assistant', message: 'Usage: /todo <instruction>' };
  }
  return { type: 'agent' };
}
```

### Transform the prompt before forwarding to the engine

```js
export default async function ({ args }) {
  return {
    type: 'agent',
    message: `Summarize the last ${args[0] ?? '10'} commits and group them by feature area.`,
  };
}
```

### Fully self-managed interaction

```js
export default async function ({ gram }) {
  await gram.reply('Choose an action from the buttons below.');
  return { type: 'void' };
}
```

- When a matched `.mjs` command returns `{ type: 'agent' }`, HAL forwards directly to the engine path. It does not re-enter the direct skill shortcut for the same slash command.
- See the Codex example's [`todo.mjs`](../../examples/codex/.hal/commands/todo.mjs) together with [`todo/SKILL.md`](../../examples/codex/.agents/skills/todo/SKILL.md) for a full hybrid command+skill flow:
  `/todo` is handled programmatically with buttons, while `/todo ...` is yielded to the engine so the skill can edit `TODOS.md`.

- [`examples/obsidian/.hal/commands/status.mjs`](../../examples/obsidian/.hal/commands/status.mjs) — project-specific command using `projectCtx.config`
- [`examples/.hal/commands/context.mjs`](../../examples/.hal/commands/context.mjs) — global command that dumps the full resolved context
- [`examples/.hal/commands/joke.mjs`](../../examples/.hal/commands/joke.mjs) — global command using `agent.call` with live status cycling and `onProgress` updates

## Hot-reload

Commands (and [skills](../skills/README.md)) are **hot-reloaded** — drop a new `.mjs` file or `SKILL.md` into the relevant directory and the bot registers it with Telegram automatically, with no restart. The AI engine can write new command or skill files as part of a task and users see them in the `/` menu immediately.

## See also

- [Skills](../skills/README.md) — engine skill folders exposed as slash commands; can be overridden by a custom `.hal/commands/{name}.mjs` with the same name.
