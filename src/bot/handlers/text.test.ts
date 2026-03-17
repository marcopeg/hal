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

vi.mock("./session.js", () => ({
  shouldLoadSessionFromUserDir: vi.fn(() => false),
  shouldPersistUserSessionToUserDir: vi.fn(() => false),
}));

import { classifyBufferedTextParts, createTextHandler } from "./text.js";

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
        start: { enabled: true, sessionReset: false },
        help: { enabled: true },
        reset: {
          enabled: true,
          sessionReset: false,
          message: {},
          timeout: 60,
        },
        clear: { enabled: true },
        info: {
          enabled: true,
          cwd: true,
          engineModel: true,
          session: true,
          context: true,
        },
        git: { enabled: false },
        model: { enabled: false },
        engine: { enabled: false },
        npm: {
          enabled: false,
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
  });

  afterEach(() => {
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
});
