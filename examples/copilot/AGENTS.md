AGENTS.md

Obsidian-Compatible CRM Frontmatter Schema, Folder Layout, Examples, and Agent Responsibilities

1. Purpose

This document defines a canonical, Obsidian-friendly frontmatter schema and vault layout for a lightweight CRM. It also documents agent responsibilities for automation, validation, and maintenance.

2. Frontmatter Schema

- Required fields
  - id: string (unique, slug or UUID) — e.g., "contact-2026-03-14-001" or a UUID
  - title: string — human-friendly page title (Contact name, Company name, Deal title)
  - type: enum [contact, company, deal, interaction, task, template]
  - created: date-time (ISO 8601) — when the page was created
  - updated: date-time (ISO 8601) — when the page was last updated

- Recommended fields
  - status: string — e.g., active, lead, customer, lost
  - owner: string — person responsible, e.g. "@alice" or a note link [[Alice]]
  - company: string or link — company id or wikilink ([[Company Acme]])
  - email: string
  - phone: string
  - tags: array — free-form tags (e.g., ["lead","priority-high"]) 
  - stage: string — e.g., qualification, proposal, negotiation, closed
  - priority: integer or string — e.g., 1,2,3 or high/med/low
  - last_interaction: date-time (ISO 8601)
  - next_action: date-time (ISO 8601) or null
  - interactions: array of interaction IDs or file paths
  - description: string — short summary

- Interaction pages (type: interaction) should include:
  - contact_id or contact: id or wikilink
  - date: date-time
  - channel: string (email, call, meeting)
  - outcome: string
  - notes: string (or body of page)

- Task pages (type: task) should include:
  - due: date-time
  - assignee: string or link
  - status: todo/in_progress/done
  - related_to: id or wikilink

3. Folder Layout (Vault)

Recommended layout under vault root:

/CRM/
  /contacts/        - Individual contact notes (type: contact)
  /companies/       - Company notes (type: company)
  /deals/           - Deal/opportunity notes (type: deal)
  /interactions/    - Meeting notes, call logs, emails (type: interaction)
  /tasks/           - Action items, reminders (type: task)
  /templates/       - Page templates for new contacts, meetings, deals
  /agents/          - Agent config & logs (non-sensitive metadata only)
  /assets/          - Attachments, exported files

Files named using id or a date-based slug (e.g. 2026-03-14-call-john-doe.md or contact-jane-doe.md). Internal linking via [[contacts/contact-jane-doe]] or simply [[Jane Doe]] if title unique.

4. Examples

Example contact (contacts/jane-doe.md):
---
id: contact-jane-doe
title: Jane Doe
type: contact
created: 2026-03-14T09:12:00Z
updated: 2026-03-14T09:12:00Z
status: lead
owner: [[Alice]]
company: [[Acme Corp]]
email: jane@example.com
phone: "+1-555-0123"
tags: ["lead","product-A"]
last_interaction: 2026-03-10T15:00:00Z
next_action: 2026-03-20T09:00:00Z
---

Short free-form notes and links follow in the body.

Example interaction (interactions/2026-03-10-jane-call.md):
---
id: int-2026-03-10-jane-call
title: Call with Jane Doe
type: interaction
date: 2026-03-10T15:00:00Z
contact: [[Jane Doe]]
channel: call
outcome: positive; requested demo
---

Notes:
- Discussed product fit; follow-up scheduled.

Example deal (deals/acme-proposal.md):
---
id: deal-acme-001
title: Acme Corp — Q2 Proposal
type: deal
created: 2026-02-25T12:00:00Z
updated: 2026-03-01T08:30:00Z
company: [[Acme Corp]]
owner: [[Bob]]
stage: proposal
priority: high
status: open
---

5. Conventions & Best Practices

- Dates: use full ISO 8601 UTC date-times when possible (YYYY-MM-DDTHH:MM:SSZ).
- IDs: stable, human-readable slugs or UUIDs. Keep them unique across types.
- Linking: prefer wikilinks [[Name]] for human navigation and explicit id fields for automation.
- Tags: use consistent tags for automation rules (e.g., "priority-high", "lead").
- Templates: create templates for each type to ensure consistent frontmatter.

6. Agent Responsibilities

Agents are automations that read and/or modify vault files; they should be deterministic, idempotent, and have limited permissions. Recommended agents:

- schema-validator
  - Scan vault for CRM pages and validate frontmatter types, required fields, and date formats.
  - Report or create issues for non-conforming pages (write to /agents/reports/).

- frontmatter-normalizer
  - Normalize date formats, canonicalize tag names, fill missing updated timestamps.
  - Add missing id fields using a deterministic slug generator when safe.

- interaction-summarizer
  - Read recent interaction pages and append or update a short summary on the related contact or deal.
  - Should not overwrite human notes; write to a clearly-namespaced field (e.g., auto_summary).

- followup-scheduler
  - Find pages with next_action in the next N days and create tasks in /tasks/ or emit calendar reminders (external integrations optional).

- backlink-maintainer
  - Ensure bidirectional relationships: when a contact references a company, optionally add a link back in the company page's related contacts list.

- backup-and-audit
  - Periodically export a machine-readable snapshot of CRM frontmatter to /agents/backups/ with timestamps for auditing.

Agent operational rules:
- Log changes under /agents/logs/ with timestamps and a brief reason.
- Never store secrets in vault pages or agent logs; use environment variables for credentials.
- Provide a dry-run mode and require explicit opt-in for write actions.
- Respect user ownership: agents should not reassign owners without explicit configuration.

7. Integration notes

- If integrating with external CRMs, map fields explicitly and preserve source metadata: e.g., source_system, source_id.
- Use a reconciliation step to avoid duplicates: prefer merging by email (for contacts) or external id.

8. Troubleshooting

- Missing fields: run schema-validator to generate a report. The report will list file paths and suggested fixes.
- Conflicting updates: agents should detect concurrent edits (via updated timestamps) and skip or create a conflict note.

9. Change log

- v1.0: Initial schema and agent responsibilities

Appendix: Templates (place in /templates/) — keep templates minimal and match frontmatter keys above.
