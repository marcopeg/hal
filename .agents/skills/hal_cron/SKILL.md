---
name: hal_cron
description: Authors and updates HAL project cron jobs in .hal/crons, choosing the right .mjs or .md format and the correct schedule fields.
public: false
---

# HAL Cron Author

Your job is to create, update, list, or remove **project-tier** HAL cron jobs in `.hal/crons/`.

Use this skill when the user asks for:

- a scheduled reminder
- a recurring report or digest
- a delayed one-off task
- a cron change, reschedule, disable, or deletion
- help deciding whether a scheduled task should be `.mjs` or `.md`

Do not use this skill for on-demand features:

- use a skill in `.agents/skills/` for prompt-driven behavior invoked by the user
- use a command in `.hal/commands/` for deterministic slash-command behavior

## What to inspect first

1. Check existing project crons in `.hal/crons/`.
2. If none exist, inspect examples under `examples/.hal/crons/` and `examples/claude-code/.hal/crons/`.
3. If the request depends on cron format details, read:
   - `docs/crons/project/README.md`
   - `docs/crons/scheduling/README.md`

## File location

Project crons always live at:

```text
{project.cwd}/.hal/crons/{name}.md
{project.cwd}/.hal/crons/{name}.mjs
```

Use short kebab-case filenames. The filename is the cron name.

## Choose the right format

### Use `.mjs` when the cron is programmatic

Choose `.mjs` when the task is deterministic or needs Telegram/API/code control:

- send a fixed reminder message
- compute output in JavaScript
- call `ctx.bot.api.sendMessage(...)` yourself
- read files, inspect git state, hit APIs, or branch on logic
- optionally call `ctx.call(...)` as one step inside a larger coded workflow

Important:

- `.mjs` `runAs` only injects `bot.userId` into cron context
- `.mjs` does **not** auto-deliver output
- if the user should receive a message, the handler must send it explicitly

### Use `.md` when the cron is prompt-driven

Choose `.md` when the main job is "ask the engine to produce text":

- summaries
- analysis
- reports
- natural-language reminders that benefit from AI wording
- prompts that rely on `${...}` or `@{...}` expansion at execution time

Important:

- `.md` supports `runAs` and `notify`
- `.md` auto-sends the generated output to those recipients
- omit both for silent log-only crons

### Default choice

Prefer `.mjs` for simple fixed reminders or deterministic logic.

Prefer `.md` for scheduled prompts whose main output is AI-generated text.

## Required cron rules

- Set exactly one of `schedule` or `runAt`.
- Set `enabled: true` unless the user explicitly wants a draft or disabled cron.
- Do not set both `schedule` and `runAt`.
- Use `runAt` for wall-clock one-offs.
- Use cron expressions for calendar-aligned recurring schedules.
- Use relative schedules like `"5m"` or `"!30s"` only when delay-from-load semantics are actually intended.

For user-facing reminders:

- prefer `runAt` over `"!30m"` or other relative single-shot schedules
- compute an absolute ISO timestamp when the timing is tied to a real date/time
- call out timezone assumptions clearly

## Scheduling guidance

### One-off

Use:

```yaml
runAt: "2026-06-01T09:00:00Z"
```

Examples:

- "tomorrow at 9" -> `runAt`
- "next Monday at noon" -> `runAt`
- "at 17:00 on March 31" -> `runAt`

### Recurring, calendar aligned

Use cron expressions in `schedule`:

- every day at 09:00 -> `"0 9 * * *"`
- weekdays at 08:00 -> `"0 8 * * 1-5"`
- every Friday at 17:00 -> `"0 17 * * 5"`
- every 10 seconds -> `"*/10 * * * * *"`

### Relative recurring

Use only when "every N from when this cron is loaded" is actually desired:

```yaml
schedule: "5m"
```

This is not calendar aligned and restarts reset the cadence anchor.

### Relative single-shot

Use only for testing or internal delayed tasks where restart-reset behavior is acceptable:

```yaml
schedule: "!30s"
```

Do not use this for human-facing reminders when a real datetime is available.

### Delayed start / expiry

Use `scheduleStarts` and `scheduleEnds` when requested:

```yaml
schedule: "*/5 * * * *"
scheduleStarts: "2m"
scheduleEnds: "1h"
```

This means: start in 2 minutes, then run every 5 minutes for 1 hour.

## Templates

### `.md` cron

```md
---
enabled: true
schedule: "0 8 * * 1-5"
runAs: ${MY_USER_ID}
notify:
  - 123456789
---

Summarise yesterday's commits in this repository.
Keep it under 10 lines and use plain text.
```

Notes:

- use `${MY_USER_ID}` when env-backed frontmatter is appropriate
- `runAs` injects user context and receives the DM
- `notify` recipients receive the DM without context injection

### `.mjs` cron

```js
export const enabled = true;
export const schedule = "0 17 * * 5";
export const runAs = Number(process.env.MY_USER_ID);

/**
 * @param {import('@marcopeg/hal').ProjectCronContext} ctx
 */
export async function handler(ctx) {
  const summary = await ctx.call(
    "Summarise this week's git activity in under 12 lines.",
  );

  await ctx.bot.api.sendMessage(
    Number(process.env.MY_USER_ID),
    summary,
  );
}
```

Notes:

- `.mjs` may be fully deterministic or may call `ctx.call(...)`
- if using `process.env.MY_USER_ID`, keep the sending logic consistent with it
- do not rely on `runAs` to send the message

## Authoring workflow

1. Identify whether the user wants create, update, list, disable, or delete.
2. Decide whether the behavior is truly scheduled. If not, switch to a command or skill instead.
3. Choose `.mjs` or `.md` based on whether execution is programmatic or prompt-driven.
4. Resolve timing into `schedule`, `runAt`, `scheduleStarts`, and `scheduleEnds`.
5. Resolve delivery:
   - `.md`: `runAs` and optional `notify`
   - `.mjs`: explicit `ctx.bot.api.sendMessage(...)`
6. Write or edit the cron file in `.hal/crons/`.
7. Keep the file minimal and production-ready. No extra prose or scaffolding.

## Clarification rules

Ask one focused question only when a missing detail blocks a correct cron:

- no usable timing information
- unclear one-off vs recurring intent
- unclear recipient when delivery matters

If the request is clearly single-shot and non-interactive, make the safest reasonable assumption and state it.

## Review checklist

Before finishing, verify:

- filename matches the cron purpose
- file is in `.hal/crons/`
- exactly one of `schedule` or `runAt` is set
- `enabled` is intentional
- `.md` uses valid frontmatter
- `.mjs` exports `handler`
- delivery behavior matches format semantics
- timezone assumptions are explicit when relevant

## References

- `docs/crons/project/README.md`
- `docs/crons/scheduling/README.md`
- `examples/.hal/crons/`
- `examples/claude-code/.hal/crons/`
