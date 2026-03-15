# HAL

Telegram bot that runs Claude Code as a personal assistant.

## Tech Stack

- TypeScript, Node.js 18+
- Grammy (Telegram bot framework)
- Pino (logging)
- Zod (config validation)
- Biome (linting/formatting)
## Commands

```bash
npm run dev       # Development with hot reload
npm run build     # Compile TypeScript
npm run lint      # Check linting and formatting
npm run lint:fix  # Fix linting and formatting
```

## Project Structure

- `src/cli.ts` - CLI entry point
- `src/bot.ts` - Bot initialization
- `src/config.ts` - Configuration loading (hal.config.{json,yaml} + env vars)
- `src/bot/handlers/` - Message handlers (text, photo, document)
- `src/bot/commands/` - Bot commands (/start, /help, /clean, /model, /engine)
- `src/claude/` - Claude Code CLI integration
- `src/user/` - User session management

## Key Patterns

- Config loaded from `hal.config.{json,yaml}` with env var overrides; `projects` is a map keyed by project key (slug), with key-derived defaults for `name` and `cwd`
- **Config scope inheritance**: every option available at the `globals` level is also available per-project; the project-level value overrides globals when set, otherwise the global value is inherited. When adding new config options, always support both scopes.
- **Default assumption for task refinement/planning**: do not ask whether globals-to-project inheritance applies. Assume it always applies for config options unless the task explicitly defines an exception.
- User data stored in `.hal/users/{userId}/`
- Claude runs as subprocess reading config from working directory
- Streaming JSON output parsed for progress updates
