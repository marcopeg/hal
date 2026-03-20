import { describe, expect, it } from "vitest";
import { ConfigLoadError, resolveProjectConfig } from "./config.js";

// ─── Helper ───────────────────────────────────────────────────────────────────

function minimalProject(overrides: Record<string, unknown> = {}) {
  return {
    telegram: { botToken: "token" },
    engine: { name: "copilot" },
    ...overrides,
  } as never;
}

const configDir = "/tmp/hal-config";

describe("resolveProjectConfig session modes", () => {
  const configDir = "/tmp/hal-config";

  it("defaults Codex to per-user mode when session is omitted", () => {
    const result = resolveProjectConfig(
      "codex-project",
      {
        telegram: { botToken: "token" },
        engine: { name: "codex" },
      } as never,
      {} as never,
      configDir,
    );

    expect(result.engineSession).toBe("user");
  });

  it("treats explicit true for Codex as per-user mode", () => {
    const result = resolveProjectConfig(
      "codex-project",
      {
        telegram: { botToken: "token" },
        engine: { name: "codex", session: true },
      } as never,
      {} as never,
      configDir,
    );

    expect(result.engineSession).toBe("user");
  });

  it("preserves explicit shared mode for Codex", () => {
    const result = resolveProjectConfig(
      "codex-project",
      {
        telegram: { botToken: "token" },
        engine: { name: "codex", session: "shared" },
      } as never,
      {} as never,
      configDir,
    );

    expect(result.engineSession).toBe("shared");
  });

  it("defaults Copilot to per-user mode when session is omitted", () => {
    const result = resolveProjectConfig(
      "copilot-project",
      {
        telegram: { botToken: "token" },
        engine: { name: "copilot" },
      } as never,
      {} as never,
      configDir,
    );

    expect(result.engineSession).toBe("user");
  });

  it("treats explicit true for Copilot as per-user mode", () => {
    const result = resolveProjectConfig(
      "copilot-project",
      {
        telegram: { botToken: "token" },
        engine: { name: "copilot", session: true },
      } as never,
      {} as never,
      configDir,
    );

    expect(result.engineSession).toBe("user");
  });

  it("preserves explicit shared mode for Copilot", () => {
    const result = resolveProjectConfig(
      "copilot-project",
      {
        telegram: { botToken: "token" },
        engine: { name: "copilot", session: "shared" },
      } as never,
      {} as never,
      configDir,
    );

    expect(result.engineSession).toBe("shared");
  });

  it("still rejects unsupported per-user mode for OpenCode", () => {
    expect(() =>
      resolveProjectConfig(
        "opencode-project",
        {
          telegram: { botToken: "token" },
          engine: { name: "opencode", session: "user" },
        } as never,
        {} as never,
        configDir,
      ),
    ).toThrow(ConfigLoadError);
  });

  it("defaults engineEnforceCwd to true", () => {
    const result = resolveProjectConfig(
      "copilot-project",
      {
        telegram: { botToken: "token" },
        engine: { name: "copilot" },
      } as never,
      {} as never,
      configDir,
    );

    expect(result.engineEnforceCwd).toBe(true);
  });

  it("inherits a globals-level enforceCwd disable", () => {
    const result = resolveProjectConfig(
      "copilot-project",
      {
        telegram: { botToken: "token" },
        engine: { name: "copilot" },
      } as never,
      {
        engine: { enforceCwd: false },
      } as never,
      configDir,
    );

    expect(result.engineEnforceCwd).toBe(false);
  });

  it("preserves a project-level enforceCwd disable", () => {
    const result = resolveProjectConfig(
      "copilot-project",
      {
        telegram: { botToken: "token" },
        engine: { name: "copilot", enforceCwd: false },
      } as never,
      {} as never,
      configDir,
    );

    expect(result.engineEnforceCwd).toBe(false);
  });

  it("allows project-level enforceCwd true to override disabled globals", () => {
    const result = resolveProjectConfig(
      "copilot-project",
      {
        telegram: { botToken: "token" },
        engine: { name: "copilot", enforceCwd: true },
      } as never,
      {
        engine: { enforceCwd: false },
      } as never,
      configDir,
    );

    expect(result.engineEnforceCwd).toBe(true);
  });

  it("defaults telegram.message.debounceMs to 1000ms", () => {
    const result = resolveProjectConfig(
      "copilot-project",
      {
        telegram: { botToken: "token" },
        engine: { name: "copilot" },
      } as never,
      {} as never,
      configDir,
    );

    expect(result.telegram.message.debounceMs).toBe(1000);
    expect(result.debounce.windowMs).toBe(1000);
  });

  it("inherits globals telegram.message.debounceMs", () => {
    const result = resolveProjectConfig(
      "copilot-project",
      {
        telegram: { botToken: "token" },
        engine: { name: "copilot" },
      } as never,
      {
        telegram: { message: { debounceMs: 750 } },
      } as never,
      configDir,
    );

    expect(result.telegram.message.debounceMs).toBe(750);
    expect(result.debounce.windowMs).toBe(750);
  });

  it("allows project telegram.message.debounceMs to override globals", () => {
    const result = resolveProjectConfig(
      "copilot-project",
      {
        telegram: { botToken: "token", message: { debounceMs: 450 } },
        engine: { name: "copilot" },
      } as never,
      {
        telegram: { message: { debounceMs: 750 } },
      } as never,
      configDir,
    );

    expect(result.telegram.message.debounceMs).toBe(450);
    expect(result.debounce.windowMs).toBe(450);
  });

  it("falls back to legacy debounce.windowMs when telegram.message.debounceMs is unset", () => {
    const result = resolveProjectConfig(
      "copilot-project",
      {
        telegram: { botToken: "token" },
        engine: { name: "copilot" },
        debounce: { windowMs: 525 },
      } as never,
      {} as never,
      configDir,
    );

    expect(result.telegram.message.debounceMs).toBe(525);
    expect(result.debounce.windowMs).toBe(525);
  });
});

// ─── Visibility defaults ───────────────────────────────────────────────────────

describe("resolveProjectConfig command visibility defaults", () => {
  it("/start is enabled but hidden from menu and help by default", () => {
    const result = resolveProjectConfig(
      "proj",
      minimalProject(),
      {} as never,
      configDir,
    );
    expect(result.commands.start.enabled).toBe(true);
    expect(result.commands.start.showInMenu).toBe(false);
    expect(result.commands.start.showInHelp).toBe(false);
  });

  it("/help is enabled and visible by default", () => {
    const result = resolveProjectConfig(
      "proj",
      minimalProject(),
      {} as never,
      configDir,
    );
    expect(result.commands.help.enabled).toBe(true);
    expect(result.commands.help.showInMenu).toBe(true);
    expect(result.commands.help.showInHelp).toBe(true);
  });

  it("/clear is enabled and visible by default", () => {
    const result = resolveProjectConfig(
      "proj",
      minimalProject(),
      {} as never,
      configDir,
    );
    expect(result.commands.clear.enabled).toBe(true);
    expect(result.commands.clear.showInMenu).toBe(true);
    expect(result.commands.clear.showInHelp).toBe(true);
  });

  it("/info is enabled and visible by default", () => {
    const result = resolveProjectConfig(
      "proj",
      minimalProject(),
      {} as never,
      configDir,
    );
    expect(result.commands.info.enabled).toBe(true);
    expect(result.commands.info.showInMenu).toBe(true);
    expect(result.commands.info.showInHelp).toBe(true);
  });

  it("/reset is disabled by default", () => {
    const result = resolveProjectConfig(
      "proj",
      minimalProject(),
      {} as never,
      configDir,
    );
    expect(result.commands.reset.enabled).toBe(false);
  });

  it("/reset visibility defaults to true when enabled", () => {
    const result = resolveProjectConfig(
      "proj",
      minimalProject(),
      {} as never,
      configDir,
    );
    expect(result.commands.reset.showInMenu).toBe(true);
    expect(result.commands.reset.showInHelp).toBe(true);
  });

  it("commands.npm.enabled defaults to false", () => {
    const result = resolveProjectConfig(
      "proj",
      minimalProject(),
      {} as never,
      configDir,
    );
    expect(result.commands.npm.enabled).toBe(false);
  });

  it("npm showInMenu and showInHelp default to true", () => {
    const result = resolveProjectConfig(
      "proj",
      minimalProject(),
      {} as never,
      configDir,
    );
    expect(result.commands.npm.showInMenu).toBe(true);
    expect(result.commands.npm.showInHelp).toBe(true);
  });

  it("project showInMenu overrides globals showInMenu for /start", () => {
    const result = resolveProjectConfig(
      "proj",
      minimalProject({ commands: { start: { showInMenu: true } } }),
      { commands: { start: { showInMenu: false } } } as never,
      configDir,
    );
    expect(result.commands.start.showInMenu).toBe(true);
  });

  it("globals showInHelp is inherited when project does not set it", () => {
    const result = resolveProjectConfig(
      "proj",
      minimalProject(),
      { commands: { help: { showInHelp: false } } } as never,
      configDir,
    );
    expect(result.commands.help.showInHelp).toBe(false);
  });

  it("project showInHelp overrides globals showInHelp", () => {
    const result = resolveProjectConfig(
      "proj",
      minimalProject({ commands: { help: { showInHelp: false } } }),
      { commands: { help: { showInHelp: true } } } as never,
      configDir,
    );
    expect(result.commands.help.showInHelp).toBe(false);
  });
});
