# Claude Code with OpenRouter Example

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

## OpenRouter

I've followed the instructions here to hook up Claude Code with free models on OpenRouter:
https://youtu.be/p4KD56w2kpc?si=okz2jrKA346iscBT

But I didn't want the token to be stored in the json, so I googled it out that ClaudeCode sources it from `ANTHROPIC_AUTH_TOKEN`, you can then store it into a _gitignored_ `.env` file:

```bash
export ANTHROPIC_AUTH_TOKEN=sk-or-v1-xxxxx
```

and then run ClaudeCode as:

```bash
source .env && claude
```

Enjoy vibe coding for free!