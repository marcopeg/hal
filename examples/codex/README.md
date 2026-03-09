# Codex Example

Example project using the Codex adapter — OpenAI's terminal-based coding agent.

## Adapter

- **Engine key:** `codex`
- **CLI tool:** `codex`
- **Instruction file:** `AGENTS.md`
- **Skills directory:** `.agents/skills/`

## HAL Capabilities

- **Per-user sessions:** no — shared session by default (experimental user mode available)
- **Session continuation:** yes — resumes via `--last`
- **Streaming progress:** no — full response returned on completion

## Notes

Supports additional permission flags: `networkAccess`, `fullDiskAccess`, and `dangerouslyEnableYolo`. These must be explicitly enabled in `hal.config.yaml` under the engine options.
