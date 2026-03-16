import pino from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildContextualPrompt } from "./prompt.js";

vi.mock("../context/resolver.js", async () => {
  const actual = await vi.importActual<typeof import("../context/resolver.js")>(
    "../context/resolver.js",
  );

  return {
    ...actual,
    resolveContext: vi.fn(async () => ({
      "project.cwd": "/repo/examples/copilot",
      "project.name": "copilot",
      "engine.name": "copilot",
    })),
  };
});

describe("buildContextualPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("places the cwd instruction before context and downloads at the end", async () => {
    const result = await buildContextualPrompt(
      {
        prompt: "Create the config file.",
        userDir: "/tmp/user",
        gramCtx: {} as never,
        downloadsPath: "/tmp/downloads",
      },
      {
        config: {
          cwd: "/repo/examples/copilot",
          configDir: "/repo",
          name: "copilot",
          slug: "copilot",
          engine: "copilot",
          engineModel: "gpt-5-mini",
          engineEnforceCwd: true,
          context: undefined,
        },
        logger: pino({ level: "silent" }),
        bootContext: {} as never,
        engine: { command: "copilot" },
      } as never,
    );

    expect(result).toBe(
      "[System: Your working directory is /repo/examples/copilot. All file read and write operations must be relative to this path. Do not create, edit, or delete files outside this directory unless the user explicitly provides an absolute path outside it.]\n\n# Context\n- project.cwd: /repo/examples/copilot\n- project.name: copilot\n- engine.name: copilot\n\n# User Message\nCreate the config file.\n\n[System: To send files to the user, write them to: /tmp/downloads]",
    );
  });

  it("keeps the original context formatting when cwd enforcement is disabled", async () => {
    const result = await buildContextualPrompt(
      {
        prompt: "Create the config file.",
        userDir: "/tmp/user",
        gramCtx: {} as never,
      },
      {
        config: {
          cwd: "/repo/examples/copilot",
          configDir: "/repo",
          name: "copilot",
          slug: "copilot",
          engine: "copilot",
          engineModel: "gpt-5-mini",
          engineEnforceCwd: false,
          context: undefined,
        },
        logger: pino({ level: "silent" }),
        bootContext: {} as never,
        engine: { command: "copilot" },
      } as never,
    );

    expect(result).toBe(
      "# Context\n- project.cwd: /repo/examples/copilot\n- project.name: copilot\n- engine.name: copilot\n\n# User Message\nCreate the config file.",
    );
  });
});
