# Session configuration

`engine.session` is a **single value** (boolean or string) that controls whether the engine uses persistent sessions and how (adapter default, shared, or per-user). Set it in globals or per-project.

## Allowed values

| Value | Meaning |
|-------|--------|
| `false` | **Stateless.** No session flags are passed to the engine; no per-user `session.json` is used. Each message starts a new session. |
| `true` | **Adapter default.** Sessions are enabled; each adapter uses its default behaviour (see [Per-engine behaviour](#per-engine-behaviour) below). Omit `engine.session` to get this. |
| `"shared"` | **Force shared.** All users share the same “continue last” session in the project `cwd`. Claude uses `--continue`; Codex/Cursor/OpenCode/Copilot use their continue-last mode. |
| `"user"` | **Force per-user.** Each Telegram user gets their own session ID (stored in `session.json`). **Not supported by all engines:** see [Support and boot errors](#support-and-boot-errors). |

## Support and boot errors

- **Claude, Antigravity:** Support `"user"` (Claude and Antigravity are per-user by default when `session: true`).
- **Codex, Cursor:** Support `"user"` via experimental per-user session ID (filesystem/CLI behaviour; see engine docs). Codex now defaults to per-user mode when `session` is omitted or set to `true`.
- **OpenCode, Copilot:** Do **not** support `"user"`. If you set `engine.session: "user"` for a project using the **opencode** or **copilot** engine, HAL fails at **boot** with a configuration error and does not start. Use `true` or `"shared"` instead.

There is no silent fallback: invalid combinations are rejected so misconfiguration is visible immediately.

## Per-engine behaviour

| Engine | `true` (default) | `"shared"` | `"user"` |
|--------|------------------|------------|-------------|
| **Claude** | Per-user (`--resume <id>`) | Shared (`--continue`) | Per-user (same as default) |
| **Antigravity** | Per-user | Per-user (no shared mode) | Per-user |
| **Codex** | **Experimental** per-user UUID ([Codex](../../engines/codex/README.md)) | Shared (`resume --last`) | **Experimental** per-user UUID ([Codex](../../engines/codex/README.md)) |
| **Cursor** | Shared (`--continue`) | Shared | **Experimental** per-user ([Cursor](../../engines/cursor/README.md)) |
| **OpenCode** | Shared (`-c`) | Shared | **Boot error** (not supported) |
| **Copilot** | Shared (`--continue`) | Shared | **Boot error** (not supported) |

## Examples

```yaml
# Default: sessions on, adapter default (omit or set true)
globals:
  engine:
    name: claude
# session: true  # optional; same as omitting

# Stateless: every message is a new session
globals:
  engine:
    name: claude
    session: false

# Claude: force shared (all users share one conversation in project cwd)
globals:
  engine:
    name: claude
    session: shared

# Codex: per-user session (experimental; default Codex behavior)
projects:
  myproject:
    engine:
      name: codex
      session: user
```

## Codex failure behavior in `"user"` mode

When Codex runs in per-user mode, HAL stores a real Codex session ID in each user's `session.json` and resumes with `codex exec resume <SESSION_ID>`.

If HAL cannot recover a user-specific Codex session ID after a fresh run:

- HAL does **not** fall back to shared `resume --last` continuation for that user.
- HAL warns the Telegram user that continuity is unavailable and future messages will run as fresh anonymous sessions until recovery succeeds.
- HAL logs the same failure in normal logs for operator visibility.

This keeps `"user"` mode isolated by default, even when Codex session discovery is temporarily unavailable.

## Invalid configuration

If you set `session: user` for a project whose engine is **opencode** or **copilot**, HAL exits at startup with:

```text
Configuration error: engine.session "user" is not supported by the <engine> adapter. Use true or "shared". See docs/config/session/README.md.
```

Fix the config (use `true` or `"shared"`) and restart.
