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
});
