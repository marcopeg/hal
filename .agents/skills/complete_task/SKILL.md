---
name: complete_task
description: Marks a task a completed and moves it to the "Completed" section of BACKLOG.md.
---

Task ID resolution (mandatory):
- If the user provides one or more task IDs as numbers (e.g. `38`, or `38, 39, 40`), optionally with extra text: parse all numbers as task IDs and use those. Ignore any non-numeric text for resolution purposes.
- If no task ID is provided: read `tasks/BACKLOG.md`, find the "In Progress" section, and take the task(s) listed there as the task(s) to complete (the active task(s)). Resolve each entry to its task file in root `tasks/` (links in BACKLOG use `./NNN.slug.md` under "In Progress").
- For each task ID or active-task entry: ensure the task file exists in root `tasks/` (in progress). Zero-pad numeric IDs to 3 digits (e.g. 38 → 038) and find the task file matching `**/NNN.*.md` (excluding `*.plan.md`). Tasks in drafts, ready, or completed are not valid for completion in this skill.
- If multiple tasks are to be completed (multiple IDs or multiple entries in "In Progress"), complete each in turn using the same steps and conventions below; process one task fully (move files, update BACKLOG) before moving to the next.

For each task to complete: identify the task file and the relative plan file, then move the task markdown from "In Progress" (root `tasks/`) to the "Completed" section in BACKLOG.md and update the task status to "completed". Ensure that all links and references are updated accordingly.

Also move the task and plan files from `tasks/` to `tasks/completed/`, maintaining the same filename. For example, if the task file is `tasks/010.opencode.md` and the plan file is `tasks/010.opencode.plan.md`, they should be moved to `tasks/completed/010.opencode.md` and `tasks/completed/010.opencode.plan.md` respectively.

BACKLOG link convention (mandatory):
- in `tasks/BACKLOG.md`, completed entries must link as `./completed/...`
- use only relative links from `tasks/BACKLOG.md`; never use `tasks/...` prefixes

State consistency rule:
- remove the task entry from "In Progress" when adding it to "Completed"
- ensure the task appears only in "Completed" after this skill finishes

Completed ordering rule (mandatory):
- treat the "Completed" section as a historical log ordered by completion time
- when completing a task, append its entry to the end of the "Completed" list
- never sort or reorder completed entries by numeric task id
- never suggest sorting completed tasks numerically