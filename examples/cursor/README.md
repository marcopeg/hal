# Cursor Example

Example project using the Cursor adapter — the AI-native code editor's background agent mode.

## Adapter

- **Engine key:** `cursor`
- **CLI tool:** `agent` (Cursor background agent)
- **Instruction file:** `AGENTS.md` (also `.cursor/rules/*.mdc`)
- **Skills directories:** `.agents/skills/`, `.cursor/skills/`

## HAL Capabilities

- **Per-user sessions:** no — shared session by default (experimental user mode available)
- **Session continuation:** yes — via `--continue`
- **Streaming progress:** no — full response returned on completion

## Notes

Default model is `auto` (Cursor selects the best available model). Per-user session support is experimental and parses the session ID from agent output. Rules in `.cursor/rules/` take higher precedence than `AGENTS.md`.
