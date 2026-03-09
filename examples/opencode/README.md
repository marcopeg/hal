# OpenCode Example

Example project using the OpenCode adapter — an open-source terminal AI coding agent.

## Adapter

- **Engine key:** `opencode`
- **CLI tool:** `opencode`
- **Instruction file:** `AGENTS.md`
- **Skills directories:** `.agents/skills/`, `.opencode/skills/`, `.claude/skills/`

## HAL Capabilities

- **Per-user sessions:** no — shared session only
- **Session continuation:** yes — shared session via `-c`
- **Streaming progress:** no — full response returned on completion

## Notes

Does not support per-user isolation; all Telegram users share the same session. Configuring `session: "user"` will cause a boot error. This is a basic prompt/response adapter without live streaming.
