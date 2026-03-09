# Antigravity Example

Example project using the Antigravity adapter — a wrapper around Google's Gemini CLI coding agent.

## Adapter

- **Engine key:** `antigravity`
- **CLI tool:** `gemini`
- **Instruction file:** `GEMINI.md`
- **Skills directory:** `.agent/skills/`

## HAL Capabilities

- **Per-user sessions:** yes — each Telegram user gets an isolated session
- **Session continuation:** yes — resumed via `--resume`
- **Streaming progress:** yes — JSONL output streamed live to Telegram

## Notes

Defaults to `yolo` approval mode for headless operation. Configurable via `approvalMode` (`default`, `auto_edit`, `yolo`). Sandbox mode is also available. Defaults to `user` session mode.
