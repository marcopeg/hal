# Claude Code with OpenRouter

Example project showing how to run the `claude` engine through OpenRouter instead
of Anthropic's default API.

This setup has three moving parts:

1. HAL launches the Claude Code CLI in the project `cwd`.
2. HAL sources `engine.envFile` into the Claude child process before launch.
3. Claude Code also reads local project settings from `.claude/settings.json`.

If any of those disagree, the effective runtime behavior depends on which layer
owns that setting.

## What each file does

| File | Purpose | Used by |
|------|---------|---------|
| `.env` | Secrets and runtime env vars | HAL, before spawning `claude` |
| `.claude/settings.json` | Claude Code local project settings | Claude Code CLI |
| `examples/hal.config.yaml` | HAL project definition and engine args | HAL |

## Priority and precedence

These are the rules that matter for this example.

### 1. HAL `engine.model` overrides `.claude/settings.json`

If `examples/hal.config.yaml` sets:

```yaml
projects:
  claude-code-or:
    engine:
      name: claude
      model: some-model
```

HAL launches Claude as:

```bash
claude ... --model some-model
```

That CLI flag wins over `ANTHROPIC_MODEL` in `.claude/settings.json`.

In other words:

- `engine.model` in HAL is authoritative for model selection
- `.claude/settings.json` is only a fallback when HAL does not pass `--model`

### 2. `engine.envFile` is how HAL injects auth into the Claude subprocess

If `examples/hal.config.yaml` sets:

```yaml
projects:
  claude-code-or:
    engine:
      envFile: .env
```

HAL resolves that path relative to the project `cwd`, sources it, and then
executes `claude`.

That means variables in `.env` are present in the child process environment when
Claude starts.

For this example, the important ones are:

```bash
export ANTHROPIC_BASE_URL=https://openrouter.ai/api
export ANTHROPIC_API_KEY=""
export ANTHROPIC_AUTH_TOKEN=sk-or-v1-...
```

### 3. `.claude/settings.json` can set env too, but it is not a secret store

Claude Code reads `.claude/settings.json` from the project directory and applies
its `env` block for the session.

This file is good for:

- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_API_KEY=""`
- a default `ANTHROPIC_MODEL`

This file is not a good place for:

- real API secrets you do not want committed

For this example, keep the real OpenRouter key in `.env`, not in
`.claude/settings.json`.

### 4. Existing Claude login state can still interfere

If Claude Code was previously logged in with Anthropic on this machine, cached
auth may still be active.

Before testing OpenRouter, run:

```bash
claude auth logout
```

Then verify:

```bash
claude auth status --json
```

You should not still be using a first-party Anthropic login if you expect the
OpenRouter token from `.env` to be the active auth path.

## Recommended setup

Use one source of truth for each concern:

- HAL chooses the model
- `.env` carries the secret token
- `.claude/settings.json` pins the base URL and clears Anthropic API key fallback

That avoids hidden conflicts.

## Step-by-step setup

### 1. Create the OpenRouter key

Get an API key from [OpenRouter](https://openrouter.ai/keys).

### 2. Put the key in `.env`

Create `examples/claude-code-or/.env`:

```bash
export ANTHROPIC_BASE_URL=https://openrouter.ai/api
export ANTHROPIC_API_KEY=""
export ANTHROPIC_AUTH_TOKEN=sk-or-v1-xxxxxxxx
```

Why each variable matters:

- `ANTHROPIC_BASE_URL` points Claude Code at OpenRouter's Anthropic-compatible API
- `ANTHROPIC_AUTH_TOKEN` is the OpenRouter key Claude should use
- `ANTHROPIC_API_KEY=""` must be explicitly blank to avoid falling back to normal Anthropic API key behavior

### 3. Configure local Claude project settings

Set `examples/claude-code-or/.claude/settings.json` to:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://openrouter.ai/api",
    "ANTHROPIC_API_KEY": "",
    "ANTHROPIC_MODEL": "anthropic/claude-sonnet-4.5"
  }
}
```

Notes:

- This acts as local Claude-side configuration
- `ANTHROPIC_MODEL` here is only a fallback if HAL does not pass `--model`
- Prefer Anthropic models through OpenRouter for Claude Code compatibility

### 4. Configure HAL

In `examples/hal.config.yaml`, configure the project:

```yaml
claude-code-or:
  active: true
  cwd: ./claude-code-or
  engine:
    name: claude
    model: anthropic/claude-sonnet-4.5
    envFile: .env
```

Important:

- `cwd` decides where Claude runs
- `envFile` is resolved relative to that `cwd`
- `model` here overrides the model from `.claude/settings.json`

### 5. Clear old Claude auth state

If this machine has ever used Claude Code with Anthropic login:

```bash
claude auth logout
```

This is easy to miss and is one of the main reasons the setup appears to ignore
OpenRouter.

### 6. Start HAL and confirm config loading

When HAL starts, you should see a line like:

```text
Configuration sourced:
  ...
  engine.envFile [claude-code-or]: /path/to/examples/claude-code-or/.env
```

That confirms HAL found the file and will source it before launching Claude.

### 7. Verify Claude outside HAL first

Before debugging Telegram flow, verify the Claude CLI directly:

```bash
cd examples/claude-code-or
set -a
. ./.env
set +a
claude auth status --json
claude -p "Reply with OK" --output-format json
```

If this direct Claude run does not work, HAL will not work either.

## Effective behavior summary

For this example, the effective runtime values should be:

| Concern | Source of truth | Why |
|---------|------------------|-----|
| Working directory | `hal.config.yaml` `cwd` | HAL launches Claude there |
| OpenRouter base URL | `.env` and `.claude/settings.json` | Either is fine; keeping both is acceptable |
| Auth token | `.env` via `engine.envFile` | Secret should stay out of committed settings |
| Anthropic API key fallback | `.env` and `.claude/settings.json` set to empty string | Prevents fallback to Anthropic auth path |
| Model | `hal.config.yaml` `engine.model` | HAL passes `--model`, which wins |

## Common failure modes

### Claude still uses Anthropic login

Symptom:

- `claude auth status --json` shows `loggedIn: true`
- provider still behaves like first-party Anthropic auth

Fix:

```bash
claude auth logout
```

### The model is not the one from `.claude/settings.json`

Symptom:

- Claude runs a different model than the one in local settings

Cause:

- HAL passed `--model` from `engine.model`

Fix:

- either remove `engine.model` from HAL
- or make `engine.model` and `ANTHROPIC_MODEL` match

### HAL reads the env file but Claude still does not authenticate

Symptom:

- HAL logs show the correct `engine.envFile`
- Claude still behaves as if no OpenRouter token is active

Check:

1. `ANTHROPIC_AUTH_TOKEN` is actually present in `.env`
2. `ANTHROPIC_API_KEY` is explicitly `""`
3. cached Claude auth was cleared with `claude auth logout`
4. direct manual `claude` invocation works from this project directory

## Manual usage without HAL

```bash
cd examples/claude-code-or
set -a
. ./.env
set +a
claude
```

## References

- [OpenRouter guide: Claude Code integration](https://openrouter.ai/docs/guides/coding-agents/claude-code-integration)
- [Claude Code](https://code.claude.com/)
