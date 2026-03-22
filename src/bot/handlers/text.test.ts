import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Context } from "grammy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../agent/index.js", () => ({
  createAgent: vi.fn(),
  getSkillsDirs: vi.fn(() => []),
}));

vi.mock("../../context/resolver.js", () => ({
  resolveContext: vi.fn(),
}));

vi.mock("../../default-models.js", () => ({
  getDefaultEngineModel: vi.fn(() => "engine-defaults"),
}));

vi.mock("../../telegram/chunker.js", () => ({
  sendChunkedResponse: vi.fn(async () => undefined),
}));

vi.mock("../../telegram/fileSender.js", () => ({
  sendDownloadFiles: vi.fn(async () => 0),
}));

vi.mock("../../user/setup.js", () => ({
  clearSessionData: vi.fn(async () => undefined),
  ensureUserSetup: vi.fn(async () => undefined),
  getDownloadsPath: vi.fn(() => "/tmp/downloads"),
  getSessionId: vi.fn(async () => null),
  saveSessionId: vi.fn(async () => undefined),
}));

vi.mock("../commands/loader.js", () => ({
  resolveCommandPath: vi.fn(() => null),
  resolveSkillEntry: vi.fn(async () => null),
}));

vi.mock("../commands/npm/index.js", () => ({
  executeNpmScript: vi.fn(async () => undefined),
}));

vi.mock("../commands/npm/scripts.js", () => ({
  NpmScriptError: class NpmScriptError extends Error {},
  readPackageScripts: vi.fn(() => ({ build: "tsc", test: "vitest" })),
  resolveAllowedScripts: vi.fn((available: string[]) => available),
}));

vi.mock("./session.js", () => ({
  shouldLoadSessionFromUserDir: vi.fn(() => false),
  shouldPersistUserSessionToUserDir: vi.fn(() => false),
}));

import { createAgent } from "../../agent/index.js";
import { resolveContext } from "../../context/resolver.js";
import { sendChunkedResponse } from "../../telegram/chunker.js";
import { resolveCommandPath, resolveSkillEntry } from "../commands/loader.js";
import { executeNpmScript } from "../commands/npm/index.js";
import {
  readPackageScripts,
  resolveAllowedScripts,
} from "../commands/npm/scripts.js";
import { classifyBufferedTextParts, createTextHandler } from "./text.js";

const tempDirs: string[] = [];

async function writeCommandModule(source: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "hal-command-"));
  tempDirs.push(dir);
  const filePath = join(dir, "command.mjs");
  await writeFile(filePath, source, "utf8");
  return filePath;
}

function createProjectContext(execute = vi.fn()) {
  return {
    config: {
      slug: "test-project",
      name: "Test Project",
      cwd: "/tmp/project",
      configDir: "/tmp/config",
      dataDir: "/tmp/data",
      logDir: "/tmp/logs",
      telegram: {
        botToken: "token",
        message: { debounceMs: 1000 },
      },
      access: {
        allowedUserIds: [],
        dangerouslyAllowUnrestrictedAccess: false,
      },
      engine: "copilot",
      engineCommand: undefined,
      engineModel: undefined,
      engineEnforceCwd: true,
      engineEnvFile: undefined,
      engineSession: false,
      engineSessionMsg: "hi!",
      codex: {
        networkAccess: false,
        fullDiskAccess: false,
        dangerouslyEnableYolo: false,
      },
      antigravity: {
        approvalMode: "yolo",
        sandbox: false,
      },
      copilot: { allowAllPaths: false },
      logging: { level: "info", flow: true, persist: false },
      rateLimit: { max: 10, windowMs: 60_000 },
      debounce: { windowMs: 1000 },
      transcription: { model: "base.en", mode: "confirm" },
      context: undefined,
      providerModels: [],
      providerDefaultModel: undefined,
      availableEngines: ["copilot"],
      commands: {
        start: {
          enabled: true,
          showInMenu: false,
          showInHelp: false,
          sessionReset: false,
        },
        help: { enabled: true, showInMenu: true, showInHelp: true },
        reset: {
          enabled: false,
          showInMenu: true,
          showInHelp: true,
          sessionReset: false,
          message: {},
          timeout: 60,
        },
        clear: { enabled: true, showInMenu: true, showInHelp: true },
        info: {
          enabled: true,
          showInMenu: true,
          showInHelp: true,
          cwd: true,
          engineModel: true,
          session: true,
          context: true,
        },
        git: { enabled: false, showInMenu: true, showInHelp: true },
        model: { enabled: false, showInMenu: true, showInHelp: true },
        engine: { enabled: false, showInMenu: true, showInHelp: true },
        npm: {
          enabled: false,
          showInMenu: true,
          showInHelp: true,
          whitelist: undefined,
          blacklist: undefined,
          timeoutMs: 60_000,
          maxOutputChars: 4000,
          sendAsFileWhenLarge: true,
        },
      },
    },
    logger: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    bootContext: {} as never,
    engine: {
      name: "Copilot",
      command: "copilot",
      check: vi.fn(),
      sessionCapabilities: {
        supportsUserIsolation: true,
        defaultMode: "user",
        sharedContinuationRequiresMarker: false,
      },
      execute,
      parse: vi.fn((result) => ({ text: result.output })),
      skillsDirs: vi.fn(() => []),
      instructionsFile: vi.fn(() => "AGENTS.md"),
    },
  } as unknown as import("../../types.js").ProjectContext;
}

/** Same as createProjectContext but with npm enabled. */
function createNpmProjectContext(execute = vi.fn()) {
  return {
    config: {
      slug: "test-project",
      name: "Test Project",
      cwd: "/tmp/project",
      configDir: "/tmp/config",
      dataDir: "/tmp/data",
      logDir: "/tmp/logs",
      telegram: {
        botToken: "token",
        message: { debounceMs: 1000 },
      },
      access: {
        allowedUserIds: [],
        dangerouslyAllowUnrestrictedAccess: false,
      },
      engine: "copilot",
      engineCommand: undefined,
      engineModel: undefined,
      engineEnforceCwd: true,
      engineEnvFile: undefined,
      engineSession: false,
      engineSessionMsg: "hi!",
      codex: {
        networkAccess: false,
        fullDiskAccess: false,
        dangerouslyEnableYolo: false,
      },
      antigravity: {
        approvalMode: "yolo",
        sandbox: false,
      },
      copilot: { allowAllPaths: false },
      logging: { level: "info", flow: true, persist: false },
      rateLimit: { max: 10, windowMs: 60_000 },
      debounce: { windowMs: 1000 },
      transcription: { model: "base.en", mode: "confirm" },
      context: undefined,
      providerModels: [],
      providerDefaultModel: undefined,
      availableEngines: ["copilot"],
      commands: {
        start: {
          enabled: true,
          showInMenu: false,
          showInHelp: false,
          sessionReset: false,
        },
        help: { enabled: true, showInMenu: true, showInHelp: true },
        reset: {
          enabled: false,
          showInMenu: true,
          showInHelp: true,
          sessionReset: false,
          message: {},
          timeout: 60,
        },
        clear: { enabled: true, showInMenu: true, showInHelp: true },
        info: {
          enabled: true,
          showInMenu: true,
          showInHelp: true,
          cwd: true,
          engineModel: true,
          session: true,
          context: true,
        },
        git: { enabled: false, showInMenu: true, showInHelp: true },
        model: { enabled: false, showInMenu: true, showInHelp: true },
        engine: { enabled: false, showInMenu: true, showInHelp: true },
        npm: {
          enabled: true,
          showInMenu: true,
          showInHelp: true,
          whitelist: undefined,
          blacklist: undefined,
          timeoutMs: 60_000,
          maxOutputChars: 4000,
          sendAsFileWhenLarge: true,
        },
      },
    },
    logger: {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    bootContext: {} as never,
    engine: {
      name: "Copilot",
      command: "copilot",
      check: vi.fn(),
      sessionCapabilities: {
        supportsUserIsolation: true,
        defaultMode: "user",
        sharedContinuationRequiresMarker: false,
      },
      execute,
      parse: vi.fn((result) => ({ text: result.output })),
      skillsDirs: vi.fn(() => []),
      instructionsFile: vi.fn(() => "AGENTS.md"),
    },
  } as never;
}

function createGramCtx(
  text: string,
  messageId: number,
  userId = 123,
  options?: {
    replyImpl?: () => Promise<{ message_id: number }>;
  },
): Context {
  let replyMessageId = 1000 + messageId;

  return {
    from: { id: userId, first_name: "Test", username: "test-user" },
    chat: { id: userId },
    message: { text, message_id: messageId },
    reply: vi.fn(async () => {
      if (options?.replyImpl) {
        return options.replyImpl();
      }

      replyMessageId += 1;
      return { message_id: replyMessageId };
    }),
    api: {
      editMessageText: vi.fn(async () => undefined),
      deleteMessage: vi.fn(async () => undefined),
    },
  } as never;
}

describe("classifyBufferedTextParts", () => {
  it("joins probable fragments without separators by default", () => {
    expect(
      classifyBufferedTextParts([
        { text: "hello", messageId: 2 },
        { text: "world", messageId: 3 },
      ]),
    ).toEqual({ mode: "fragment", text: "helloworld" });
  });

  it("joins high-confidence burst messages with newlines", () => {
    expect(
      classifyBufferedTextParts([
        { text: "First sentence.", messageId: 2 },
        { text: "Second sentence.", messageId: 3 },
      ]),
    ).toEqual({ mode: "burst", text: "First sentence.\nSecond sentence." });
  });

  it("uses hybrid reconstruction for short lead-ins followed by near-limit chunks", () => {
    expect(
      classifyBufferedTextParts([
        { text: "Write this 1-1 down:", messageId: 10 },
        { text: `${"a".repeat(4090)}you`, messageId: 11 },
        { text: `know${"b".repeat(4085)}`, messageId: 12 },
      ]),
    ).toEqual({
      mode: "hybrid",
      text: `Write this 1-1 down:\n${"a".repeat(4090)}you know${"b".repeat(4085)}`,
    });
  });
});

describe("createTextHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(createAgent).mockReturnValue({ call: vi.fn() } as never);
    vi.mocked(resolveContext).mockResolvedValue({} as never);
    vi.mocked(resolveCommandPath).mockReturnValue(null);
    vi.mocked(resolveSkillEntry).mockResolvedValue(null);
    vi.mocked(executeNpmScript).mockResolvedValue(undefined);
    vi.mocked(readPackageScripts).mockReturnValue({
      build: "tsc",
      test: "vitest",
    });
    vi.mocked(resolveAllowedScripts).mockImplementation(
      (available: string[]) => available,
    );
  });

  afterEach(async () => {
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => rm(dir, { recursive: true, force: true })),
    );
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("buffers rapid multi-message input below 4096 into one engine call", async () => {
    const execute = vi.fn(async ({ prompt }: { prompt: string }) => ({
      success: true,
      output: prompt,
    }));
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());
    const firstCtx = createGramCtx("alpha ", 10);
    const secondCtx = createGramCtx("beta", 11);

    await handler(firstCtx);
    await handler(secondCtx);

    expect(execute).not.toHaveBeenCalled();
    expect(firstCtx.reply).not.toHaveBeenCalled();
    expect(secondCtx.reply).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].prompt).toBe("alpha beta");
  });

  it("keeps extending the debounce window while new parts keep arriving within 1000ms", async () => {
    const execute = vi.fn(async ({ prompt }: { prompt: string }) => ({
      success: true,
      output: prompt,
    }));
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());

    for (let index = 0; index < 20; index += 1) {
      await handler(createGramCtx(`part-${index}|`, 100 + index));
      if (index < 19) {
        await vi.advanceTimersByTimeAsync(950);
      }
    }

    expect(execute).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(999);
    expect(execute).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].prompt).toBe(
      Array.from({ length: 20 }, (_, index) => `part-${index}|`).join(""),
    );
  });

  it("does not send a working status before the debounce window closes", async () => {
    const execute = vi.fn(async ({ prompt }: { prompt: string }) => ({
      success: true,
      output: prompt,
    }));
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());
    const firstCtx = createGramCtx("alpha ", 200);
    const secondCtx = createGramCtx("beta", 201);

    await handler(firstCtx);
    await handler(secondCtx);

    expect(firstCtx.reply).not.toHaveBeenCalled();
    expect(secondCtx.reply).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(secondCtx.reply).toHaveBeenCalled();
  });

  it("joins burst-style messages with newlines before execution", async () => {
    const execute = vi.fn(async ({ prompt }: { prompt: string }) => ({
      success: true,
      output: prompt,
    }));
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());

    await handler(createGramCtx("First sentence.", 20));
    await handler(createGramCtx("Second sentence.", 21));
    await vi.advanceTimersByTimeAsync(1000);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].prompt).toBe(
      "First sentence.\nSecond sentence.",
    );
  });

  it("dispatches slash-prefixed text immediately without debounce delay", async () => {
    const execute = vi.fn(async ({ prompt }: { prompt: string }) => ({
      success: true,
      output: prompt,
    }));
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());

    await handler(createGramCtx("/not-a-command", 30));

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].prompt).toBe("/not-a-command");
  });

  it("sends typed assistant results without calling the engine", async () => {
    const execute = vi.fn();
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());
    const gramCtx = createGramCtx("/status", 50);
    const commandPath = await writeCommandModule(`
      export const description = "status";
      export default async function () {
        return { type: "assistant", message: "Status ready" };
      }
    `);

    vi.mocked(resolveCommandPath).mockReturnValue(commandPath);

    await handler(gramCtx);

    expect(execute).not.toHaveBeenCalled();
    expect(sendChunkedResponse).toHaveBeenCalledWith(gramCtx, "Status ready");
    expect(vi.mocked(resolveSkillEntry)).not.toHaveBeenCalled();
    expect(projectCtx.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        commandName: "status",
        resultType: "assistant",
      }),
      "Custom .mjs command handled the message directly",
    );
  });

  it("forwards typed agent results with the original slash message", async () => {
    const execute = vi.fn(async ({ prompt }: { prompt: string }) => ({
      success: true,
      output: prompt,
    }));
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());
    const gramCtx = createGramCtx("/todo buy milk", 51);
    const commandPath = await writeCommandModule(`
      export const description = "todo";
      export default async function () {
        return { type: "agent" };
      }
    `);

    vi.mocked(resolveCommandPath).mockReturnValue(commandPath);
    vi.mocked(resolveSkillEntry).mockResolvedValue({
      command: "todo",
      description: "todo",
      filePath: "/tmp/skill/SKILL.md",
      skillPrompt: "ignored",
      telegram: true,
      source: "skill",
    });

    await handler(gramCtx);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].prompt).toBe("/todo buy milk");
    expect(vi.mocked(resolveSkillEntry)).not.toHaveBeenCalled();
    expect(projectCtx.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        commandName: "todo",
        resultType: "agent",
        replacedPrompt: false,
      }),
      "Custom .mjs command yielded to the agent",
    );
  });

  it("forwards typed agent results with a replacement message", async () => {
    const execute = vi.fn(async ({ prompt }: { prompt: string }) => ({
      success: true,
      output: prompt,
    }));
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());
    const gramCtx = createGramCtx("/summarize latest", 52);
    const commandPath = await writeCommandModule(`
      export const description = "summarize";
      export default async function () {
        return {
          type: "agent",
          message: "Summarize the latest commits grouped by feature area."
        };
      }
    `);

    vi.mocked(resolveCommandPath).mockReturnValue(commandPath);

    await handler(gramCtx);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].prompt).toBe(
      "Summarize the latest commits grouped by feature area.",
    );
  });

  it("stops routing on typed void results", async () => {
    const execute = vi.fn();
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());
    const gramCtx = createGramCtx("/picker", 53);
    const commandPath = await writeCommandModule(`
      export const description = "picker";
      export default async function ({ gram }) {
        await gram.reply("Choose one");
        return { type: "void" };
      }
    `);

    vi.mocked(resolveCommandPath).mockReturnValue(commandPath);

    await handler(gramCtx);

    expect(execute).not.toHaveBeenCalled();
    expect(sendChunkedResponse).not.toHaveBeenCalled();
    expect(gramCtx.reply).toHaveBeenCalledWith("Choose one");
    expect(projectCtx.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        commandName: "picker",
        resultType: "void",
      }),
      "Custom .mjs command handled the message without agent handoff",
    );
  });

  it("rejects malformed typed command results", async () => {
    const execute = vi.fn();
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());
    const gramCtx = createGramCtx("/broken", 54);
    const commandPath = await writeCommandModule(`
      export const description = "broken";
      export default async function () {
        return { type: "assistant" };
      }
    `);

    vi.mocked(resolveCommandPath).mockReturnValue(commandPath);

    await handler(gramCtx);

    expect(execute).not.toHaveBeenCalled();
    expect(gramCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Command failed: Invalid command return value"),
    );
  });

  it("warns and keeps legacy string results working", async () => {
    const execute = vi.fn();
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());
    const gramCtx = createGramCtx("/legacy", 55);
    const commandPath = await writeCommandModule(`
      export const description = "legacy";
      export default async function () {
        return "Legacy reply";
      }
    `);

    vi.mocked(resolveCommandPath).mockReturnValue(commandPath);

    await handler(gramCtx);

    expect(execute).not.toHaveBeenCalled();
    expect(sendChunkedResponse).toHaveBeenCalledWith(gramCtx, "Legacy reply");
    expect(projectCtx.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ commandName: "legacy" }),
      expect.stringContaining("legacy string"),
    );
  });

  it("warns and forwards legacy undefined returns", async () => {
    const execute = vi.fn(async ({ prompt }: { prompt: string }) => ({
      success: true,
      output: prompt,
    }));
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());
    const gramCtx = createGramCtx("/legacy-undefined", 56);
    const commandPath = await writeCommandModule(`
      export const description = "legacy-undefined";
      export default async function () {}
    `);

    vi.mocked(resolveCommandPath).mockReturnValue(commandPath);

    await handler(gramCtx);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].prompt).toBe("/legacy-undefined");
    expect(projectCtx.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ commandName: "legacy-undefined" }),
      expect.stringContaining("legacy falsy value"),
    );
  });

  it("warns and forwards legacy null returns", async () => {
    const execute = vi.fn(async ({ prompt }: { prompt: string }) => ({
      success: true,
      output: prompt,
    }));
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());
    const gramCtx = createGramCtx("/legacy-null", 57);
    const commandPath = await writeCommandModule(`
      export const description = "legacy-null";
      export default async function () {
        return null;
      }
    `);

    vi.mocked(resolveCommandPath).mockReturnValue(commandPath);

    await handler(gramCtx);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].prompt).toBe("/legacy-null");
    expect(projectCtx.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ commandName: "legacy-null" }),
      expect.stringContaining("legacy falsy value"),
    );
  });

  it("warns and forwards other falsy legacy returns", async () => {
    const execute = vi.fn(async ({ prompt }: { prompt: string }) => ({
      success: true,
      output: prompt,
    }));
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());
    const gramCtx = createGramCtx("/legacy-false", 58);
    const commandPath = await writeCommandModule(`
      export const description = "legacy-false";
      export default async function () {
        return false;
      }
    `);

    vi.mocked(resolveCommandPath).mockReturnValue(commandPath);

    await handler(gramCtx);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].prompt).toBe("/legacy-false");
    expect(projectCtx.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ commandName: "legacy-false" }),
      expect.stringContaining("legacy falsy value"),
    );
  });

  it("keeps spaced-apart messages as separate executions", async () => {
    const execute = vi.fn(async ({ prompt }: { prompt: string }) => ({
      success: true,
      output: prompt,
    }));
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());

    await handler(createGramCtx("first", 40));
    await vi.advanceTimersByTimeAsync(1000);

    await handler(createGramCtx("second", 41));
    expect(execute).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0][0].prompt).toBe("first");
    expect(execute.mock.calls[1][0].prompt).toBe("second");
  });

  it("routes a slash command to a project custom command when resolveCommandPath returns a path", async () => {
    const { resolveCommandPath: mockResolveCommandPath } = await import(
      "../commands/loader.js"
    );
    vi.mocked(mockResolveCommandPath).mockReturnValueOnce("/tmp/deploy.mjs");

    const execute = vi.fn();
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());

    await handler(createGramCtx("/deploy", 50));

    // Engine execute should NOT be called — custom command handled it
    expect(execute).not.toHaveBeenCalled();
  });

  it("falls through to agent for a slash command that matches no custom command or skill", async () => {
    const execute = vi.fn(async ({ prompt }: { prompt: string }) => ({
      success: true,
      output: prompt,
    }));
    const projectCtx = createProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());

    await handler(createGramCtx("/unknown-command", 60));

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].prompt).toBe("/unknown-command");
    expect(projectCtx.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        commandName: "unknown-command",
      }),
      "Slash command did not match a custom handler; forwarding to agent",
    );
  });

  it("routes an npm-derived command when npm is enabled and script matches", async () => {
    const { readPackageScripts: mockRead, resolveAllowedScripts: mockResolve } =
      await import("../commands/npm/scripts.js");
    const { executeNpmScript: mockExecute } = await import(
      "../commands/npm/index.js"
    );

    vi.mocked(mockRead).mockReturnValueOnce({ build: "tsc" });
    vi.mocked(mockResolve).mockReturnValueOnce(["build"]);

    const execute = vi.fn();
    const projectCtx = createNpmProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());
    await handler(createGramCtx("/build", 70));

    expect(execute).not.toHaveBeenCalled();
    expect(mockExecute).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "build",
    );
  });

  it("falls through to agent when npm is enabled but command does not match any script", async () => {
    const { readPackageScripts: mockRead, resolveAllowedScripts: mockResolve } =
      await import("../commands/npm/scripts.js");
    vi.mocked(mockRead).mockReturnValueOnce({ build: "tsc" });
    vi.mocked(mockResolve).mockReturnValueOnce(["build"]);

    const execute = vi.fn(async ({ prompt }: { prompt: string }) => ({
      success: true,
      output: prompt,
    }));
    const projectCtx = createNpmProjectContext(execute);
    const handler = createTextHandler(projectCtx, new Set<number>());
    await handler(createGramCtx("/notanpmscript", 80));

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].prompt).toBe("/notanpmscript");
  });
});
