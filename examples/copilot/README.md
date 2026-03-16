# GitHub Copilot Example

Example project using the GitHub Copilot adapter — Microsoft's AI coding agent integrated into the CLI.

## Adapter

- **Engine key:** `copilot`
- **CLI tool:** `copilot`
- **Instruction file:** `AGENTS.md` (also `.github/copilot-instructions.md`)
- **Skills directories:** `.agents/skills/`, `.github/skills/`, `.claude/skills/`

## HAL Capabilities

- **Per-user sessions:** yes — default behavior (experimental; backed by Copilot JSON output)
- **Shared sessions:** yes — opt in with `engine.session: "shared"`
- **Session continuation:** yes — per-user via `--resume <UUID>` or shared via `--continue`
- **Streaming progress:** no — full response returned on completion

## Notes

Copilot now defaults to experimental per-user isolation in HAL. A real session UUID is recovered from Copilot's structured JSON output and stored in each Telegram user’s `session.json`. If you explicitly want all users to share one Copilot conversation, configure `engine.session: "shared"`. Instruction files can also use path-specific rules via `.github/instructions/*.instructions.md`.
