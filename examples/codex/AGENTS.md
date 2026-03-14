# CRM Agent Guide (Obsidian-Compatible)

This project manages CRM data in Obsidian Markdown notes using YAML frontmatter as the source of truth for entities.

## Core Rules

- Every CRM note must include a `type` field in frontmatter.
- Every CRM note must be stored in the folder defined for its entity type.
- Use Obsidian wiki links (`[[Note Name]]`) for relationships.
- Keep frontmatter minimal: only include optional fields when relevant.
- Dates must use ISO format: `YYYY-MM-DD`.

## Entity Schemas

### Person

- `type`: `person` (required)
- `folder`: `crm/people` (required location)
- `birthday`: `YYYY-MM-DD` (optional; can be in the future)
- `company`: `[[Company Note]]` (optional)
- `teams`: list of wiki links (optional)

Frontmatter example:

```yaml
---
type: person
birthday: 1990-08-21
company: [[Acme Inc]]
teams:
  - [[Core Team]]
  - [[Partnership Team]]
---
```

### Company

- `type`: `company` (required)
- `folder`: `crm/company` (required location)

Frontmatter example:

```yaml
---
type: company
---
```

### Project

- `type`: `project` (required)
- `folder`: `crm/projects` (required location)
- `company`: one or more company links (optional)
- `participants`: one or more person links (optional)

Frontmatter example:

```yaml
---
type: project
company:
  - [[Acme Inc]]
participants:
  - [[Jane Doe]]
  - [[John Smith]]
---
```

### Meeting

- `type`: `meeting` (required)
- `folder`: `crm/meeting` (required location)
- `participants`: one or more person links (optional)

Frontmatter example:

```yaml
---
type: meeting
participants:
  - [[Jane Doe]]
  - [[John Smith]]
---
```

## Validation Guidance

- `teams`, `company` (when multiple), and `participants` should be valid YAML lists of Obsidian links.
- For single-link fields, `company: [[Company Note]]` is allowed.
- Optional fields must be omitted when unknown or irrelevant.
