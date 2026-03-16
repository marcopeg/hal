import pino from "pino";
import { describe, expect, it } from "vitest";
import { formatContextPrompt, substituteMessage } from "../context/resolver.js";

const logger = pino({ level: "silent" });

describe("cron .md prompt body substitution", () => {
  it("resolves placeholder references from contextVars", () => {
    const result = substituteMessage(
      `Hello \${bot.firstName}! Today is \${sys.date}.`,
      { "bot.firstName": "Alice", "sys.date": "2026-03-12" },
      logger,
    );
    expect(result).toBe("Hello Alice! Today is 2026-03-12.");
  });

  it("resolves placeholders from process.env when key is absent from contextVars", () => {
    process.env._TEST_HAL_TOKEN = "secret-abc";
    const result = substituteMessage(`Token: \${_TEST_HAL_TOKEN}`, {}, logger);
    delete process.env._TEST_HAL_TOKEN;
    expect(result).toBe("Token: secret-abc");
  });

  it("resolves cron.* state vars injected into contextVars", () => {
    const result = substituteMessage(
      `Run #\${cron.runs}, last run: \${cron.lastRun}.`,
      { "cron.runs": "3", "cron.lastRun": "2026-03-12T08:00:00.000Z" },
      logger,
    );
    expect(result).toBe("Run #3, last run: 2026-03-12T08:00:00.000Z.");
  });

  it("resolves @{} shell expressions in the prompt body", () => {
    const result = substituteMessage("Echo: @{echo hello}", {}, logger);
    expect(result).toBe("Echo: hello");
  });

  it("leaves unresolved placeholder keys as empty string", () => {
    const result = substituteMessage(`Val: \${missing.key}`, {}, logger);
    expect(result).toBe("Val: ");
  });

  it("does not mutate contextVars or alter unreferenced keys", () => {
    const ctx = { "bot.firstName": "Bob", "sys.date": "2026-03-12" };
    substituteMessage(`Hi \${bot.firstName}`, ctx, logger);
    expect(ctx).toEqual({ "bot.firstName": "Bob", "sys.date": "2026-03-12" });
  });

  it("passes through a prompt with no substitution markers unchanged", () => {
    const prompt = "Check git status and summarise what changed.";
    const result = substituteMessage(prompt, {}, logger);
    expect(result).toBe(prompt);
  });

  it("formats cron prompts with the cwd system instruction when enabled", () => {
    const result = formatContextPrompt(
      {
        "project.cwd": "/repo/examples/copilot",
        "cron.runs": "3",
      },
      "Run the sync.",
      {
        cwd: "/repo/examples/copilot",
        enforceCwd: true,
      },
    );

    expect(result).toBe(
      "[System: Your working directory is /repo/examples/copilot. All file read and write operations must be relative to this path. Do not create, edit, or delete files outside this directory unless the user explicitly provides an absolute path outside it.]\n\n# Context\n- project.cwd: /repo/examples/copilot\n- cron.runs: 3\n\n# User Message\nRun the sync.",
    );
    expect(result).not.toContain("bot.messageId");
  });
});
