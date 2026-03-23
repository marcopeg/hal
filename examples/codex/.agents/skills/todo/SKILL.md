---
name: todo
title: TODO Manager
description: Read and update the project TODO list stored in TODOS.md.
telegram:
  enabled: true
  showInMenu: true
  showInHelp: true
---

Manage the project's `TODOS.md` file at the repository root.

Behavior:

- If the user message includes instructions after `/todo`, interpret them as a request to add, edit, complete, reopen, or remove entries in `TODOS.md`.
- If the user message does not include any instructions after `/todo`, show the first 10 entries from `TODOS.md`.

Formatting rules for `TODOS.md`:

- Keep the file human-readable and easy to parse from JavaScript.
- Use exactly this structure:

```md
# TODOs

- [ ] First task
- [x] Completed task
```

- Keep one TODO per line.
- Use only top-level checklist items in the form `- [ ] text` or `- [x] text`.
- Do not use tables, nested bullets, numbered lists, or multi-line TODO entries.
- Preserve existing order unless the user explicitly asks to reorder items.
- If the file does not exist yet, create it using the format above.

Response rules:

- After updating `TODOS.md`, briefly confirm what changed.
- When listing items, preserve checkbox state and show at most the first 10 TODO entries.
