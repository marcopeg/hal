# Claude Code Example

Example project using the Claude Code adapter — Anthropic's official CLI coding agent.

## Adapter

- **Engine key:** `claude`
- **CLI tool:** `claude`
- **Instruction file:** `CLAUDE.md`
- **Skills directory:** `.claude/skills/`

## HAL Capabilities

- **Per-user sessions:** yes — each Telegram user gets an isolated session
- **Session continuation:** yes — resumed via `--resume <sessionId>`
- **Streaming progress:** yes — live output forwarded to Telegram as the agent works

## Notes

Defaults to `user` session mode, meaning each Telegram user maintains their own independent conversation history. Shared mode (`session: "shared"`) is also supported via `--continue`.
