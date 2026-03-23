# HAL Video Plan

Proposed sequence of short videos that both:

- demonstrate HAL's documented capabilities;
- work as a practical onboarding path from "what is this?" to "I can use and extend it."

The sequence is intentionally progressive:

1. first value and setup;
2. daily usage;
3. advanced power-user features;
4. contributor/operator workflows.

## Suggested series shape

- Format: short product/onboarding videos
- Style: one concrete outcome per video
- Target length: 60 to 180 seconds each
- Recurring setup: one local machine, one Telegram phone, one or two sample projects

---

## 1. HAL In One Minute

- Title: HAL In One Minute
- Description: Show the core promise of HAL: run your AI coding agent from your phone while the real tooling stays on your machine.
- Expected length: 60-75 seconds
- Woohoo moment: A Telegram message triggers a real coding-agent response from a local project and streams the result back to the phone.
- Demonstrational goal: Make the value proposition instantly obvious before any setup detail.
- Preconditions:
  - HAL already configured for one sample project
  - One supported engine installed and authenticated
  - Telegram bot already connected
- What will be learned:
  - What HAL is
  - Why Telegram is the control surface
  - That HAL keeps the real project and agent local
- Script:
  1. Open on the README promise: "Run Claude Code, Copilot, and Codex from your phone."
  2. Show a local project and terminal with HAL running.
  3. Send a simple Telegram prompt like "Summarize the last commit and tell me what to fix next."
  4. Show streaming progress in Telegram.
  5. Show the final answer landing back on the phone.
  6. Close with the architecture in one line: Telegram -> HAL -> local coding CLI -> response back to Telegram.

## 2. Create Your Bot And Let Yourself In

- Title: Create Your Bot And Let Yourself In
- Description: Walk through the minimum Telegram setup: bot token plus your user ID and access control.
- Expected length: 90-120 seconds
- Woohoo moment: The viewer understands that each project gets its own bot and that only allowed users can talk to it.
- Demonstrational goal: Remove the biggest "how do I even start?" blocker.
- Preconditions:
  - Telegram app available
  - BotFather and @userinfobot accessible
- What will be learned:
  - How to create a Telegram bot
  - How to get a Telegram user ID
  - Why `allowedUserIds` matters
- Script:
  1. Open BotFather and create a bot with `/newbot`.
  2. Copy the token and explain why it should live in `.env`, not committed config.
  3. Open @userinfobot and retrieve the numeric Telegram user ID.
  4. Show `allowedUserIds` in config.
  5. Mention one bot per project and why that keeps things clean.

## 3. Wizard To First Working Project

- Title: Wizard To First Working Project
- Description: Use the setup wizard to go from an empty folder to a working HAL project with minimal friction.
- Expected length: 120-150 seconds
- Woohoo moment: The wizard produces a real config and the bot is ready without manual YAML authoring.
- Demonstrational goal: Teach the fastest official onboarding path.
- Preconditions:
  - Bot token and Telegram user ID already available
  - One engine installed
- What will be learned:
  - How to run `wiz`
  - How HAL writes config and env-backed placeholders
  - What the minimum project setup looks like
- Script:
  1. Start in an empty directory.
  2. Run `npx @marcopeg/hal wiz`.
  3. Show the wizard collecting project name, cwd, engine, bot token, and user ID.
  4. Show the generated config file and env placeholder style.
  5. Start HAL.
  6. Send a first Telegram message and show the response.

## 4. One HAL, Multiple Projects

- Title: One HAL, Multiple Projects
- Description: Show how HAL maps multiple bots/projects from one config and lets each project keep its own cwd and engine.
- Expected length: 90-120 seconds
- Woohoo moment: Two separate project bots are live, each pointing at a different folder and behaving differently.
- Demonstrational goal: Demonstrate the multi-project model clearly.
- Preconditions:
  - Basic HAL setup already working
  - Two sample projects available
  - Two Telegram bot tokens available
- What will be learned:
  - How the `projects` map works
  - That each project has its own bot, cwd, and engine settings
  - Why HAL is useful for people juggling multiple repos
- Script:
  1. Open a config with two projects.
  2. Highlight each project's `cwd`, `telegram.botToken`, and `engine`.
  3. Start HAL once.
  4. Send one message to the backend bot and one to the frontend bot.
  5. Show that the answers come from different project contexts.

## 5. Choose Engines, Models, And Session Behavior

- Title: Choose Engines, Models, And Session Behavior
- Description: Demonstrate HAL's multi-engine support, `/engine`, `/model`, and the session differences between adapters.
- Expected length: 120-180 seconds
- Woohoo moment: The same project switches engines from Telegram, and the behavior changes without changing the repo.
- Demonstrational goal: Show HAL as a router over multiple coding CLIs, not a single-engine wrapper.
- Preconditions:
  - More than one supported engine available
  - `providers` configured for engine/model switching
- What will be learned:
  - Which engines HAL supports
  - How `/engine` and `/model` work
  - Why session mode matters (`false`, `shared`, `user`)
- Script:
  1. Show the supported engines list in docs.
  2. Open config and highlight `engine.name`, `engine.model`, and `providers`.
  3. Use `/engine` to switch to another engine.
  4. Use `/model` to change the model.
  5. Briefly explain which engines stream progress and which buffer.
  6. Briefly explain session behavior differences across engines.

## 6. Built-In Commands For Daily Control

- Title: Built-In Commands For Daily Control
- Description: Tour the system commands that make HAL practical in day-to-day use: help, info, clear, reset, engine/model, and optional git/npm surfaces.
- Expected length: 120-150 seconds
- Woohoo moment: HAL feels like an operator console, not just a chat box.
- Demonstrational goal: Teach command-driven control early in the onboarding flow.
- Preconditions:
  - HAL already running
  - One project with command defaults enabled
- What will be learned:
  - What the built-in commands are for
  - The difference between visibility and routing
  - How `/clear` and `/reset` differ
- Script:
  1. Open the Telegram slash-command menu.
  2. Run `/help` and `/info`.
  3. Show `/clear` resetting the session.
  4. Show `/reset` as the stronger destructive option.
  5. Show `/engine` or `/model` if configured.
  6. Mention optional git and npm command families.

## 7. Add Your Own Commands And Skills

- Title: Add Your Own Commands And Skills
- Description: Show how HAL becomes project-specific through `.hal/commands/*.mjs` and skill folders.
- Expected length: 120-180 seconds
- Woohoo moment: A custom slash command appears in Telegram after dropping in one file, and a skill can expose prompt-based behavior with `telegram: true`.
- Demonstrational goal: Demonstrate HAL's extensibility and hot reload loop.
- Preconditions:
  - Existing HAL project
  - Access to the project filesystem
- What will be learned:
  - Difference between project commands and skills
  - Routing order and precedence
  - Hot-reload behavior
- Script:
  1. Create or reveal a simple `.hal/commands/status.mjs`.
  2. Show it appearing as `/status`.
  3. Trigger it from Telegram.
  4. Open a `SKILL.md` example with `telegram: true`.
  5. Explain that same-name `.mjs` commands override skills.
  6. Close by showing how this turns HAL into a project-specific assistant.

## 8. Send Voice, Images, Documents, And Get Files Back

- Title: Beyond Text: Voice, Images, Documents, And Files
- Description: Demonstrate HAL's multimodal Telegram workflow: voice transcription, image/document analysis, and file return from the engine.
- Expected length: 120-180 seconds
- Woohoo moment: A voice note becomes a prompt, an image gets analyzed, and a generated file comes back to Telegram.
- Demonstrational goal: Show that HAL uses Telegram as a rich interface, not only plain chat.
- Preconditions:
  - `ffmpeg` installed
  - Voice transcription configured
  - One sample image or document available
  - Engine able to generate a downloadable file
- What will be learned:
  - Voice transcription modes
  - That images/documents can be sent for analysis
  - How HAL sends generated files back through the `downloads/` folder
- Script:
  1. Send a short voice message and show the transcript UX.
  2. Mention local Whisper and the current local-only privacy model.
  3. Send an image and ask for analysis.
  4. Send a document and ask for summary or extraction.
  5. Show the engine writing a file into `downloads/`.
  6. Show the file arriving back in Telegram.

## 9. Give The Agent Better Context

- Title: Give The Agent Better Context
- Description: Show how HAL injects system/project metadata and lets you extend context with config values and hooks.
- Expected length: 120-150 seconds
- Woohoo moment: The agent starts reasoning with real timestamps, user metadata, project cwd, and custom context without extra prompt boilerplate.
- Demonstrational goal: Explain one of HAL's most distinctive features for reliable remote operation.
- Preconditions:
  - Working project config
  - One example context value or hook ready
- What will be learned:
  - What implicit context HAL injects
  - `${}`, `#{}`, and `@{}` patterns
  - Context hooks and the cwd boundary instruction
- Script:
  1. Open the context docs and point to implicit keys like `sys.*`, `bot.*`, and `project.*`.
  2. Show a custom `context:` value in config.
  3. Show a `context.mjs` hook example.
  4. Send a Telegram message that depends on current time/project data.
  5. Explain why the cwd boundary instruction matters for safe file operations.

## 10. Schedule Work With Cron Jobs

- Title: Schedule Work With Cron Jobs
- Description: Show HAL running scheduled prompts and programmatic jobs from `.hal/crons/`.
- Expected length: 120-180 seconds
- Woohoo moment: A scheduled job fires automatically and sends useful output back through Telegram.
- Demonstrational goal: Introduce automation as a built-in feature, not an afterthought.
- Preconditions:
  - A running HAL project
  - One example cron file prepared
- What will be learned:
  - Difference between `.md` and `.mjs` crons
  - Project vs system cron scope
  - Hot reload and cron logs
- Script:
  1. Open the cron docs and show the two file types.
  2. Show a simple project cron under `.hal/crons/`.
  3. Explain `enabled: true`, `schedule`, and `runAt`.
  4. Save or edit the cron and mention hot reload.
  5. Show the cron firing and delivering its output.
  6. Point to cron logs for observability.

## 11. Operate HAL Safely

- Title: Operate HAL Safely
- Description: Cover access control, env files, rate limiting, logging, and the security boundaries of different engines.
- Expected length: 120-150 seconds
- Woohoo moment: The viewer realizes HAL is usable in real life because safety and operator controls are built in.
- Demonstrational goal: Build trust and prevent bad first deployments.
- Preconditions:
  - Basic config file available
- What will be learned:
  - Why `allowedUserIds` matters
  - How env files are loaded
  - What logging/rate limiting provide
  - Why engine filesystem boundaries differ
- Script:
  1. Show `allowedUserIds` and explain why open access is dangerous.
  2. Show `.env` and `.env.local` placement.
  3. Open the logging and rate-limit docs briefly.
  4. Compare one safer engine boundary and one looser one.
  5. End on the security notice: Telegram is not end-to-end encrypted for bots.

## 12. Contribute, Extend, And Release

- Title: Contribute, Extend, And Release
- Description: Finish the series with the contributor/operator path: local dev setup, examples config, and release workflow.
- Expected length: 120-180 seconds
- Woohoo moment: HAL is not a black box; you can run it locally, extend it, and ship improvements.
- Demonstrational goal: Turn advanced users into contributors.
- Preconditions:
  - Node.js installed
  - Repo cloned locally
- What will be learned:
  - How to run HAL from the repo
  - How the `examples/` folder works
  - High-level release flow
- Script:
  1. Clone the repo and run `npm install`.
  2. Show the `examples/` folder and its `.env` pattern.
  3. Start the bot locally with the development setup.
  4. Mention where commands, skills, crons, and docs live in the repo.
  5. Show the release scripts at a high level.
  6. Close by pointing viewers back to the docs index.

---

## Coverage Checklist

This sequence covers the currently documented feature set:

- product overview and quick start
- Telegram bot creation and user ID setup
- setup wizard
- config structure, env files, and project map
- multi-project support
- multi-engine support, model switching, and session modes
- built-in commands
- custom project commands and skills
- voice, images, documents, and returned files
- context injection and hooks
- cron jobs and scheduling
- access control, logging, rate limit, and security boundaries
- contributor/development workflow

## Production Notes

- Reuse the same two sample projects across the whole series so the audience builds familiarity.
- Use one phone capture style and one terminal theme across all videos.
- Keep every video centered on one user-visible outcome, not on exhaustive explanation.
- End each video with the next video's setup dependency so the sequence doubles as onboarding.
