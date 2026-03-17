---
name: refine_task
description: Initiates a task refinement session on a given task
---

Task ID resolution (mandatory):
- If the user provides only a number (e.g. `38`) or a number plus optional text (e.g. `38` or `38 clarify scope`), treat that number as the task ID.
- Resolve the task ID to the task file: zero-pad the ID to 3 digits (e.g. 38 → 038), then find the task file under `tasks/` that matches `**/038.*.md` and is not a plan file (exclude `*.plan.md`). The task may live in `tasks/drafts/`, `tasks/ready/`, or `tasks/` (in progress). Use that task file as the task to refine.

Never modify `CHANGELOG.md` — changelog entries are managed exclusively by the release tooling, not by task refinement.

Focus on the task provided by the user. Read the task description and any related files (code, config, prompts, etc.) to fully understand the context and the requirements.

Analyze the project's context and codebase to identify any ambiguities or unclear requirements in the task description. The goal is to ensure a clear and actionable task definition for development.

Refinement scope rule (mandatory):
- refinement is only for ambiguity reduction and context definition
- do not create an execution/development plan in this skill
- do not create or edit `{task}.plan.md` in this skill
- do not move the task across lifecycle sections/folders in this skill

Start a refinement session by asking the user up to 3 clarifying questions about the task. The goal is to reduce ambiguity and ensure a clear understanding of the task requirements.

After receiving the user's answers, integrate the new information into the task's file (e.g., `tasks/drafts/002.local-config.md`) to update and clarify:
- context and constraints
- explicit expectations
- clear acceptance criteria

Continue asking questions and refining the task until you are fully satisfied with the clarity and completeness of the task description. The final refined task should be clear, unambiguous, and actionable for development.
