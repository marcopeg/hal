---
name: archive_task
description: Archives one or more tasks by moving them to tasks/archived and listing them under the Archived section of tasks/BACKLOG.md.
---

Task ID resolution (mandatory):
- If the user provides one or more task IDs as numbers (for example `76` or `76, 77`), parse all numbers as task IDs and use those.
- If no task ID is provided, read `tasks/BACKLOG.md`, find the "In Progress" section, and use the listed active task(s).
- Zero-pad numeric IDs to 3 digits, then resolve each task by finding a matching task markdown file in `tasks/`, `tasks/ready/`, or `tasks/drafts/`.
- Exclude `*.plan.md` and `*.notes.md` from task-file resolution.
- Tasks already in `tasks/completed/` or `tasks/archived/` are not valid archive targets.

Never modify `CHANGELOG.md`.

For each task to archive:

1. Create `tasks/archived/` if it does not already exist.
2. Move the main task file into `tasks/archived/`.
3. Move any sibling `*.plan.md` and `*.notes.md` files with the same base name into `tasks/archived/` as well.
4. Update the task markdown status line from `**Status**: ...` to `**Status**: archived` when such a line exists.
5. Update `tasks/BACKLOG.md` so the task appears exactly once, under `## Archived`.

BACKLOG link convention (mandatory):
- use only relative links from `tasks/BACKLOG.md`
- archived entries must link as `./archived/...`
- include `| [plan](...)` when a plan file exists
- include `| [notes](...)` when a notes file exists

State consistency rules:
- remove the task entry from any other section before adding it to "Archived"
- after archiving, the task must appear only in "Archived"
- keep unrelated tasks unchanged

Archived ordering rule (mandatory):
- treat the "Archived" section as a historical log
- append newly archived tasks to the end of the section
- never sort the archived list by numeric task ID

Use this skill for tasks that are intentionally abandoned, deferred indefinitely, or explicitly marked as "we are not going to do this".
