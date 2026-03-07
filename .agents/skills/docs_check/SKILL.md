---
name: docs_check
description: Docs QA loop: traverse README/docs links, find first ambiguity, ask one question, log Q&A to docs_QA/, update docs, then offer another round.
telegram: true
---

# docs_check

Run a **docs QA refinement loop**:

- Focus on **human-facing documentation** (`README.md`, `docs/`, and docs linked from those pages).
- Traverse docs **by following links**, not by random browsing.
- Stop at the **first** meaningful ambiguity/misinformation that needs clarification.
- Ask the user **exactly one** clarifying question.
- After the user answers, **log** the Q&A to `docs_QA/` and **incorporate** the answer into the docs.
- Then ask whether the user wants **another round**.

---

## Scope and rules

- **Primary scope**: root `README.md`, `docs/README.md` (if present), and any Markdown files they link to (directly or transitively), especially under `docs/`.
- **Allowed expansion**: if you need to validate a claim, you may read config/examples and code anywhere in the repo to remove ambiguity and avoid misinformation.
- **One issue per run**: do not collect a list; find the *next* highest-signal issue and resolve it.
- **Do not invent facts**: if something is not supported by the code/config or is uncertain, it must become a question or be reworded as an explicitly optional/unknown item.
- **Docs conventions**: when editing docs, follow the project’s docs conventions (see the `docs` skill) for structure and relative links.

---

## Workflow

### 1) Traverse documentation by links

Start from:

- `README.md` (repo root)
- then `docs/README.md` (if it exists and/or is linked from the root README)

For each doc page you read:

- Extract **relative** Markdown links.
- Prefer links that stay within `docs/` (or other in-repo docs).
- Keep a **visited set** so you don’t loop.
- Continue until you find the first refinement-worthy point (next section).

Notes:

- External links may be used to validate a claim, but the primary goal is to improve *in-repo* docs.
- If a link target doesn’t exist, that’s a valid refinement candidate (broken link).

### 2) Identify the first refinement-worthy point

Stop traversal when you hit the first high-signal issue, such as:

- A statement that appears **wrong** when compared to the code/config.
- **Ambiguity** (unclear default, unclear prerequisite, unclear meaning of a term, unclear “where to configure X”).
- **Outdated instructions** (commands, file paths, config keys).
- **Missing steps** that are required to make an instruction work.
- **Inconsistent terminology** across pages.

If needed, read relevant code/config to confirm what’s true before asking the user.

### 3) Ask the user exactly one question

Send **one** question. Use this format:

- **Where found**: `path/to/doc.md` (plus section heading if applicable)
- **What’s unclear / risky**: 1–2 sentences
- **Question**: one direct question the user can answer
- **Proposed answer options (optional)**: 1–3 candidate answers to choose from (still keep only one question)

Important:

- The “Question” must be **answerable in one response**.
- Do not ask multiple sub-questions. If you need multiple facts, pick the **single** most blocking one.

### 4) After the user answers: log Q&A (pure log)

Create (if missing) a folder at repo root:

- `docs_QA/`

Then write a new Markdown log file with name:

- `YYYY-MM-HH-mm.as-log-from-<slug>.md`

Where:

- `YYYY` is 4-digit year
- `MM` is 2-digit month
- `HH` is 2-digit hour (24h)
- `mm` is 2-digit minute
- `<slug>` is derived from the question text:
  - lowercase
  - convert spaces to `-`
  - remove characters other than `a-z`, `0-9`, and `-`
  - trim to ~60 chars
  - if the slug becomes empty, use `question`

If the computed filename already exists, append `-2`, `-3`, ... before `.md`.

Log file contents must include:

- `## Question` (verbatim question you asked)
- `## Answer` (verbatim user answer)
- `## Source` (doc file(s) and section, if known)

This file is a **pure log**; do not edit it later.

### 5) Incorporate the answer into the docs

Update the documentation so the clarified point is no longer ambiguous/misleading.

Guidelines:

- Prefer the **smallest** edit that makes the docs accurate.
- If a change affects config keys or examples, also update the canonical reference (`docs/config/reference.yaml`) and any relevant doc pages.
- Keep links relative and navigable on GitHub.

### 6) Close the loop

After edits:

- Summarize what changed (1–3 bullets), and point to the log file in `docs_QA/`.
- Ask the user if they want **another docs_check round**.

---

## Example (shape only)

You ask:

- **Where found**: `docs/config/README.md` → “Defaults”
- **What’s unclear / risky**: The docs imply default X, but config/example suggests Y.
- **Question**: “Should the default engine be `copilot` or `codex` when unset?”
- **Proposed answer options (optional)**: `copilot` / `codex`

Then after the user answers, you:

- Create `docs_QA/2026-03-14-09.as-log-from-should-the-default-engine-be-copilot-or-codex.md`
- Update the relevant doc section(s) so the default is explicit and correct.
