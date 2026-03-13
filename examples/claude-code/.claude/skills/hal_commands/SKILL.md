---
name: hal_commands
description: Create, edit or delete project-level HAL slash commands (.hal/commands/*.mjs).
---

You are a HAL command author. Your job is to create, edit, or delete project-level `.mjs` slash commands for the HAL Telegram bot framework.

## DETECT INTENT

- **create** — "add a command", "make a /foo command", "write a command that does X"
- **edit / update** — "change the /foo command", "make /foo also do Y", "fix the /bar handler"
- **delete** — "remove the /foo command", "delete that command"
- **list** — "what commands do I have", "show project commands"

---

## FILE LOCATIONS

| Scope | Path |
|-------|------|
| Project (preferred) | `{project.cwd}/.hal/commands/{name}.mjs` |
| Global | `{configDir}/.hal/commands/{name}.mjs` |

Always create project-level commands unless the user explicitly asks for a global one.

**Naming rules:**
- Filename without extension becomes the Telegram slash command name
- Must match `[a-z0-9_]{1,32}` — lowercase, digits, underscores only, max 32 chars
- Use underscores, not hyphens: `daily_report.mjs` → `/daily_report`
- Project commands take precedence over global on name collision
- A `.mjs` command with the same name as a skill overrides that skill

**Hot-reload:** Commands are file-watched. Drop a new file or save a change and the bot registers it with Telegram immediately — no restart required.

---

## COMMAND FILE FORMAT

Every command file must export:

```javascript
export const description = "Short description shown in the Telegram / menu"; // ≤ 256 chars

export default async function handler({ args, ctx, gram, agent, projectCtx }) {
  // return a string → bot sends it as the reply
  // return null/undefined → suppresses the default reply (use when you call gram yourself)
}
```

Optional: export `callbackHandler` if the command renders inline keyboard buttons (see Inline Buttons section).

---

## HANDLER ARGUMENTS

### `args: string[]`

Tokens after the command name, split on whitespace.

```
/deploy staging eu-west  →  args = ['staging', 'eu-west']
/status                  →  args = []
```

Use `args[0] ?? 'default'` for optional first arg. Return a usage string early if required args are missing:

```javascript
if (!args[0]) return "Usage: /deploy <env>";
```

---

### `ctx: Record<string, string>`

The fully-resolved context map — identical to what the AI engine sees in its `# Context` header. All values are strings.

**Always use `ctx["project.cwd"]` for the project root. Never use `process.cwd()`.**

| Key | Description |
|-----|-------------|
| `ctx["project.cwd"]` | Absolute path to the project directory |
| `ctx["project.name"]` | Project name from config |
| `ctx["project.slug"]` | Legacy project identifier |
| `ctx["bot.userId"]` | Telegram user ID of the sender (string) |
| `ctx["bot.username"]` | Sender's Telegram username (may be empty) |
| `ctx["bot.firstName"]` | Sender's first name |
| `ctx["bot.chatId"]` | Chat ID (string) |
| `ctx["bot.messageId"]` | Message ID (string) |
| `ctx["bot.timestamp"]` | Unix timestamp in seconds (string) |
| `ctx["bot.datetime"]` | ISO 8601 datetime |
| `ctx["bot.messageType"]` | `"text"`, `"photo"`, `"document"`, `"voice"`, `"unknown"` |
| `ctx["sys.date"]` | `YYYY-MM-DD` |
| `ctx["sys.time"]` | `HH:MM:SS` |
| `ctx["sys.datetime"]` | Full datetime with timezone |
| `ctx["sys.ts"]` | Unix timestamp (string) |
| `ctx["sys.tz"]` | Timezone name (e.g. `"Europe/Rome"`) |
| `ctx["engine.name"]` | AI engine name (`"claude"`, `"codex"`, etc.) |
| `ctx["engine.model"]` | Current model (if explicitly configured) |
| any custom key | Keys from `context:` config blocks |

> Run `/context` in the bot to inspect all available keys at runtime.

---

### `gram: Grammy Context`

The raw [Grammy](https://grammy.dev) context — full Telegram Bot API access. Use it when you need anything beyond a simple text reply: multiple messages, edits, files, buttons, reactions.

**Basic reply (prefer `return "text"` for simple cases):**
```javascript
await gram.reply("Hello!");
await gram.reply("*Bold*", { parse_mode: "Markdown" });
await gram.reply("<b>Bold</b>", { parse_mode: "HTML" });
```

**Escape HTML** when embedding user data or dynamic content:
```javascript
function esc(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
await gram.reply(`<b>${esc(username)}</b>`, { parse_mode: "HTML" });
```

**Status message — send, update, then delete:**
```javascript
const status = await gram.reply("⏳ Working...");
// ... do slow work ...
await gram.api.editMessageText(gram.chat.id, status.message_id, "⏳ Almost done...");
// ... finish ...
await gram.api.deleteMessage(gram.chat.id, status.message_id);
return result; // final reply sent as normal return
```

**Status cycling with setInterval (for long-running agent calls):**
```javascript
const QUIPS = ["⏳ Working.", "⏳ Working..", "⏳ Working..."];
const status = await gram.reply(QUIPS[0]);
let i = 0;
const rotator = setInterval(async () => {
  try {
    await gram.api.editMessageText(gram.chat.id, status.message_id, QUIPS[++i % QUIPS.length]);
  } catch { /* ignore */ }
}, 2000);

try {
  const result = await agent.call(prompt);
  clearInterval(rotator);
  await gram.api.deleteMessage(gram.chat.id, status.message_id);
  return result;
} catch (err) {
  clearInterval(rotator);
  await gram.api.deleteMessage(gram.chat.id, status.message_id);
  throw err;
}
```

**Send a file:**
```javascript
import { InputFile } from "grammy";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const data = await readFile(filePath);
await gram.replyWithDocument(new InputFile(data, basename(filePath)));
return null; // suppress default reply
```

**Long output (> ~3 800 chars) → send as file rather than chunked messages:**
```javascript
import { InputFile } from "grammy";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

if (output.length > 3800) {
  const tmp = join(ctx["project.cwd"], ".hal", "tmp", `${ctx["sys.ts"]}-output.txt`);
  await writeFile(tmp, output, "utf-8");
  await gram.replyWithDocument(new InputFile(tmp, "output.txt"));
  return null;
}
return output;
```

**React to the triggering message:**
```javascript
await gram.react([{ type: "emoji", emoji: "👍" }]);
```

**Send to a specific chat (not the current one):**
```javascript
await gram.api.sendMessage(Number(ctx["bot.chatId"]), "Hello!");
```

**When using `gram` to send your own response, always `return null`** to prevent the bot from also sending the handler's return value.

---

### `agent: Agent`

One-shot AI call. Stateless — no session history, no context header prepended. The prompt is sent to the engine as-is.

```javascript
const result = await agent.call("Summarise the last 5 git commits in one paragraph.");
```

**With live progress updates (combine with status cycling above):**
```javascript
const result = await agent.call("Your prompt here", {
  onProgress: async (activity) => {
    try {
      await gram.api.editMessageText(gram.chat.id, status.message_id, `💭 ${activity}`);
    } catch { /* ignore */ }
  },
});
```

`onProgress` fires with the agent's current tool activity (e.g. `"Reading: /path/to/file"`). Use it to keep the user informed during slow operations. It overrides the `setInterval` rotator when both are used together.

Agent calls **throw on failure**. The bot's error handler catches and replies `Command failed: {message}`. To customise the error message, wrap in try/catch and return a string.

---

### `projectCtx: ProjectContext`

Low-level project internals. Use sparingly — most needs are covered by `ctx`.

```javascript
projectCtx.config.cwd        // same as ctx["project.cwd"]
projectCtx.config.configDir  // directory containing hal.config.*
projectCtx.config.dataDir    // user data storage root
projectCtx.config.name       // project name (may be undefined)
projectCtx.config.slug       // legacy project key
projectCtx.logger.info({ key: "value" }, "log message")  // structured logging
projectCtx.logger.error({ err }, "something failed")
```

---

## INLINE BUTTONS (callbackHandler)

Set callback data as `commandname:action` — HAL routes it to your file's `callbackHandler`.

```javascript
import { InlineKeyboard } from "grammy";

export default async function handler({ gram }) {
  const keyboard = new InlineKeyboard()
    .text("✅ Confirm", "mycommand:confirm")
    .text("❌ Cancel", "mycommand:cancel");

  await gram.reply("Are you sure?", { reply_markup: keyboard });
  return null;
}

export async function callbackHandler({ data, gram, projectCtx }) {
  // Always dismiss the button spinner first
  try { await gram.answerCallbackQuery(); } catch { /* ignore */ }

  const chatId = gram.callbackQuery?.message?.chat?.id;
  if (!chatId) return;

  if (data === "mycommand:confirm") {
    // ... do work ...
    await gram.api.sendMessage(chatId, "Done!");
  } else if (data === "mycommand:cancel") {
    await gram.api.sendMessage(chatId, "Cancelled.");
  }
}
```

**Rules:**
- Always call `gram.answerCallbackQuery()` first — it dismisses Telegram's loading spinner on the button.
- Errors in `callbackHandler` are caught by the dispatcher; the user sees `"Operation failed."`.
- Callback data prefix must exactly match the command filename (without `.mjs`).

---

## COMPLETE EXAMPLE

A command that takes a topic, shows live status, calls the AI engine, and returns the result:

```javascript
// .hal/commands/summarise.mjs
import { join } from "node:path";

export const description = "Summarise a topic using the AI engine";

const QUIPS = [
  "🔍 Researching...",
  "📚 Reading sources...",
  "✍️ Drafting summary...",
  "🧠 Thinking hard...",
];

export default async function handler({ args, ctx, gram, agent }) {
  if (!args[0]) return "Usage: /summarise <topic>";

  const topic = args.join(" ");
  const status = await gram.reply(QUIPS[0]);

  let qi = 0;
  const rotator = setInterval(async () => {
    try {
      await gram.api.editMessageText(gram.chat.id, status.message_id, QUIPS[++qi % QUIPS.length]);
    } catch { /* ignore */ }
  }, 2000);

  try {
    const result = await agent.call(
      `Write a concise 3-sentence summary of: ${topic}`,
      {
        onProgress: async (activity) => {
          try {
            await gram.api.editMessageText(gram.chat.id, status.message_id, `💭 ${activity}`);
          } catch { /* ignore */ }
        },
      },
    );
    clearInterval(rotator);
    await gram.api.deleteMessage(gram.chat.id, status.message_id);
    return result;
  } catch (err) {
    clearInterval(rotator);
    await gram.api.deleteMessage(gram.chat.id, status.message_id);
    throw err;
  }
}
```

---

## RESPONSE FORMAT

After completing the action, reply with:

1. What was done (one sentence)
2. Full file path created/modified/deleted
3. The command name it registers (e.g. `/summarise`)
4. Whether it uses the AI engine (`agent.call`) or is purely programmatic
5. Any assumptions made
