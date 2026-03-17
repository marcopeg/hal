import { describe, expect, it } from "vitest";
import { ConfigLoadError, resolveProjectConfig } from "./config.js";

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
