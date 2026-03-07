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
- **Code improvements**: Your primary scope is documentation. You must NEVER automatically modify source code (`.ts`, `.js`, etc.) or application logic. However, if while reviewing the docs you feel there is an improvement that can be made in the source code, you should present it as an option to the user, asking for explicit confirmation to proceed before making any code changes. Otherwise, your edits must strictly be limited to Markdown documentation files and `docs_QA/` logs. Even if the user's answer describes how the system *should* work, you must only update the documentation to reflect it unless they confirm a code change.
- **Allowed expansion**: if you need to validate a claim, you may read config/examples and code anywhere in the repo to remove ambiguity and avoid misinformation.
- **One issue per run**: do not collect a list; find the *next* highest-signal issue and resolve it.
- **Do not invent facts**: if something is not supported by the code/config or is uncertain, it must become a question or be reworded as an explicitly optional/unknown item.
- **Docs conventions**: when editing docs, follow the project’s docs conventions (see the `docs` skill) for structure and relative links.
- **Tone of voice**: keep docs **concise but friendly**.
- **Telegram constraints**:
  - The skill is exposed as a Telegram command only when `telegram: true` is present.
  - Keep frontmatter `description` \(\le 256\) characters.
  - The command name comes from the **skill folder name** (must match Telegram’s `/[a-z0-9_]{1,32}` rule).

### Root README intent (be explicit)

Treat the root `README.md` as **marketing + quickstart**:

- It should immediately communicate **HAL’s value** (why try it).
- It should contain a **super quick starter** (the most basic “how to run” command(s)).
- It should link to the documentation index (typically `docs/README.md`) and also provide a short **“docs map”**:
  - main doc sections listed in the root README
  - each with a 1–2 sentence description + a link

The exhaustive, canonical details live under `docs/`.

---

## Workflow

### 1) Traverse documentation by links

Start from:

- `README.md` (repo root; treat it as marketing + quickstart)
- find and follow the link into the docs index (prefer `docs/README.md` when present)
- then continue traversal from within `docs/`

For each doc page you read:

- Extract **relative** Markdown links.
- Prefer links that stay within `docs/` (or other in-repo docs).
- Keep a **visited set** so you don’t loop.
- Continue until you find the first refinement-worthy point (next section).

Notes:

- External links may be used to validate a claim, but **do not** treat external pages as required reading for traversal.
- Only follow external links when it helps confirm or correct an in-repo statement (or to pick the right wording/link to add).
- If a link target doesn’t exist, that’s a valid refinement candidate (broken link).

#### Broken link handling (still one question)

If the first issue you hit is a broken in-repo link:

1. **Diagnose** the likely cause before asking:
   - wrong relative path (needs `../`)
   - wrong filename/casing (`README.md` vs `readme.md`)
   - moved docs (target exists elsewhere)
   - intended doc page never created
2. Ask the user **one** question that includes both the decision and (if needed) the guidance:
   - **Where found**: source doc + the broken link text/URL
   - **What seems wrong**: your best hypothesis (1 sentence)
   - **Question**: “What should we do with this link: **remove it**, **fix it to an existing page**, or **create a new doc page**?”
   - If they choose **create**, ask them (in the same question) to include 2–5 bullets of what the new page should cover and where it should live under `docs/`.

### 2) Identify the first refinement-worthy point

Stop traversal when you hit the first high-signal issue, such as:

- A statement that appears **wrong** when compared to the code/config.
- **Ambiguity** (unclear default, unclear prerequisite, unclear meaning of a term, unclear “where to configure X”).
- **Outdated instructions** (commands, file paths, config keys).
- **Missing steps** that are required to make an instruction work.
- **Inconsistent terminology** across pages.

If needed, read relevant code/config to confirm what’s true before asking the user.

Practical rule of thumb while validating docs:

- When a page discusses configuration keys, defaults, or examples, consult `docs/config/reference.yaml` (canonical key reference) and `examples/hal.config.yaml` (copy/paste example) as needed to avoid stale claims.

#### Priority order (first issue per run)

When you encounter multiple issues, pick the *first* one to resolve using this priority:

1. Broken links (targets missing / wrong path)
2. Ambiguity (unclear defaults, unclear meaning, unclear “where to set X”)
3. Missing steps / non-working quickstart or commands
4. Correctness/misinformation vs code/config
5. Structure/wording/typos (only if nothing above is present)

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
- Timestamp uses **local machine time** (not UTC).
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
