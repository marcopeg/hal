# HAL Development Guide

This guide explains how to work on HAL as a developer, and how to use your
local HAL build as global `hal` and `hal-dev` commands in other repositories.

## Prerequisites

- Node.js 18+
- npm
- At least one engine CLI installed if you want to run end-to-end bot tests
  (Claude, Copilot, Codex, OpenCode, Cursor, or Antigravity)

## 1) Local development in this repository

From the HAL repo root:

```bash
npm install
```

Useful commands:

```bash
npm run dev        # start HAL with hot reload using examples config
npm run start      # run HAL once using examples config
npm run build      # compile TypeScript to dist/
npm run test       # run test suite
npm run lint       # lint checks
npm run lint:fix   # fix lint issues
```

Notes:

- `npm run dev` and `npm run start` use `examples` as config dir by default.
- The published CLI binary is `hal -> dist/cli.js`, so global linked usage
  always runs from `dist/`.

## 2) Use local HAL as global commands (`hal` + `hal-dev`)

This is useful when your real project lives in another repository and you want
to run HAL there, while still developing HAL from this repo.

### Step 1: build and link HAL globally

From this repo:

```bash
npm install
npm run build
npm link
```

Check:

```bash
which hal
hal --help
```

### Step 2: run HAL from another repo

In your external repo:

```bash
hal start --config .
```

Or point to a specific config file/directory:

```bash
hal start --config /absolute/path/to/config-or-directory
```

### `hal` vs `hal-dev`

- `hal` runs compiled output (`dist/cli.js`) and requires `npm run build` after
  source changes.
- `hal-dev` runs `src/cli.ts` through `tsx` and does not require rebuilds for
  one-shot runs.

Examples:

```bash
hal-dev start --config .
hal-dev wiz --config .
```

## 3) Development loop when linked globally

### A) Compiled CLI loop (`hal`)

Because `hal` points to `dist/cli.js`, rebuild after code changes:

```bash
cd /Users/marcopeg/dv/hal
npm run build
```

Then re-run `hal ...` in your external repo. No re-link is needed after each
build.

### B) No-build CLI loop (`hal-dev`)

Use `hal-dev` to run directly from TypeScript:

```bash
hal-dev start --config .
```

This picks up source changes the next time you run it, without `npm run build`.

### C) True hot reload while process is running

Use watch mode:

```bash
hal-dev --watch start --config .
```

This restarts on source file changes, so you do not need to manually re-run the
command.

## 4) Unlink when done

Remove global link:

```bash
npm unlink -g @marcopeg/hal
```

If needed, also unlink from a consumer repo:

```bash
npm unlink @marcopeg/hal
```

## 5) Troubleshooting

### `hal` is still an older version

- Run `which hal` and verify it points to npm global bin.
- Rebuild this repo: `npm run build`.
- Re-run `npm link` if global symlink is broken.

### `hal-dev` fails with "missing tsx binary"

- Run `npm install` in the HAL repo root.
- Re-run `npm link` if needed.

### Config/env resolution is unexpected

- HAL resolves config from `--config` (or current working dir if omitted).
- Keep project-specific `.env` near the selected config dir unless overridden by
  project `engine.envFile`.

### Claude runs outside expected project boundary

- `cwd` sets process working directory, but not a full sandbox.
- For Claude projects, tighten `.claude/settings.json` (for example
  `allowedPaths`) and disable risky tools (for example `Bash`) when strict
  confinement is required.
