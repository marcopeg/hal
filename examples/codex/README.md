# Codex Example

Example project using the Codex adapter — OpenAI's terminal-based coding agent.

## Adapter

- **Engine key:** `codex`
- **CLI tool:** `codex`
- **Instruction file:** `AGENTS.md`
- **Skills directory:** `.agents/skills/`

## HAL Capabilities

- **Per-user sessions:** yes — default behavior (experimental; backed by local Codex session files)
- **Shared sessions:** yes — opt in with `engine.session: "shared"`
- **Session continuation:** yes — resumes via stored Codex session UUIDs in per-user mode, or `resume --last` in shared mode
- **Streaming progress:** yes

## Notes

Supports additional permission flags: `networkAccess`, `fullDiskAccess`, and `dangerouslyEnableYolo`. These must be explicitly enabled in `hal.config.yaml` under the engine options.

This example also includes a `todo` skill plus a matching `.hal/commands/todo.mjs` command. `/todo` renders a paginated view from `TODOS.md`, while `/todo ...` yields to the agent so the `todo` skill can update the same Markdown checklist file.
