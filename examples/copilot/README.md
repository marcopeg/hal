# GitHub Copilot Example

Example project using the GitHub Copilot adapter — Microsoft's AI coding agent integrated into the CLI.

## Adapter

- **Engine key:** `copilot`
- **CLI tool:** `copilot`
- **Instruction file:** `AGENTS.md` (also `.github/copilot-instructions.md`)
- **Skills directories:** `.agents/skills/`, `.github/skills/`, `.claude/skills/`

## HAL Capabilities

- **Per-user sessions:** no — shared session only
- **Session continuation:** yes — shared session via `--continue`
- **Streaming progress:** no — full response returned on completion

## Notes

Does not support per-user isolation; all Telegram users share the same session. Configuring `session: "user"` will cause a boot error. Instruction files can also use path-specific rules via `.github/instructions/*.instructions.md`.
