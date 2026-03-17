---
name: execute_task
description: Executes a given task based on a detailed development plan
---

Task ID resolution (mandatory):
- If the user provides only a number (e.g. `38`) or a number plus optional text (e.g. `38` or `38 start with phase 2`), treat that number as the task ID.
- Resolve the task ID to the task file: zero-pad the ID to 3 digits (e.g. 38 → 038), then find the task file under `tasks/` that matches `**/038.*.md` and is not a plan file (exclude `*.plan.md`). The task may live in `tasks/drafts/`, `tasks/ready/`, or `tasks/` (in progress). Use that task file as the task to execute.

Focus on the task provided by the user. Read the task description, the plan and any related files (code, config, prompts, etc.) to fully understand the context and the requirements.

Before executing the task:
- move the task file into the root `tasks/` directory (for execution state)
- if the task is in `tasks/drafts/` or `tasks/ready/`, move it to `tasks/`
- move the plan file to `tasks/` as well when present
- update BACKLOG.md so the task appears in "In Progress" with links pointing to `./...` (relative to `tasks/BACKLOG.md`)
- remove the task entry from "Drafts" and "Ready Tasks" if present, so it appears in exactly one section

Important lifecycle rule:
- never move the task or plan file to `tasks/completed/` in this skill
- never place/update the task in the "Completed" section of BACKLOG.md in this skill
- completion transitions are handled only by the `complete-task` skill

BACKLOG link convention (mandatory):
- use only relative links from `tasks/BACKLOG.md`
- for in-progress root tasks use `./XXX.task-name.md` and `./XXX.task-name.plan.md`
- never use `tasks/...` prefixes inside BACKLOG entries

Never modify `CHANGELOG.md` — changelog entries are managed exclusively by the release tooling, not by task execution.

Then, execute the task as specified in the task's plan file. This may involve writing code, configuring systems, or performing other actions as needed to complete the task successfully.

Make sure to follow the instructions in the plan carefully, and refer back to the task description and related files as needed to ensure that you are meeting all requirements and delivering the expected results.

When a plan step or phase is completed, flag it as done in the plan document and move on to the next step or phase until execution is finished. Leave the task in the execution state (`tasks/` + "In Progress") and hand off final completion to `complete-task`. If you encounter any issues or need clarification, refer back to the task description and related files, and if necessary, ask for additional information from the user.

Annotate your actions and decisions in the plan file as you execute the task, providing explanations for why you are taking certain steps or making specific choices. This will help ensure that your execution is transparent and that the user can understand the rationale behind your actions.

## Execution notes (mandatory)

At the end of execution, write a `tasks/{XXX}.{task-name}.notes.md` file (same naming convention as the task file, with `.notes.md` suffix). This file must be a detailed log of the execution session. Include:

- **Decisions** — every non-trivial choice made during implementation: why an approach was chosen over alternatives, trade-offs considered, anything that deviated from the obvious path.
- **Problems encountered** — bugs, type errors, test failures, unexpected codebase constraints, and how each was resolved.
- **Divergence from plan** — any step where the implementation differed from what the plan described, and the reason why.
- **Known limitations** — anything left incomplete, deferred, or known to be fragile.

Write this file even when execution went smoothly — document the absence of problems if so. The notes file is the long-term institutional memory of how and why the task was implemented the way it was.

Add a link to the notes file in BACKLOG.md alongside the task entry in "In Progress":
```
- [XXX — Task title](./XXX.task-name.md) | [plan](./XXX.task-name.plan.md) | [notes](./XXX.task-name.notes.md)
```