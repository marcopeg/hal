import { describe, expect, it } from "vitest";
import type { CommandEntry } from "./loader.js";
import {
  commandsForHelp,
  commandsForTelegramMenu,
  sanitizeNpmScriptName,
} from "./loader.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEntry(
  command: string,
  source: CommandEntry["source"],
  telegram?: boolean,
): CommandEntry {
  return {
    command,
    description: `${command} desc`,
    filePath: "",
    source,
    telegram,
  };
}

// ─── commandsForTelegramMenu ──────────────────────────────────────────────────

describe("commandsForTelegramMenu", () => {
  it("includes all non-skill commands when no visibility map is provided", () => {
    const cmds = [
      makeEntry("help", "builtin"),
      makeEntry("start", "builtin"),
      makeEntry("deploy", "project"),
    ];
    expect(commandsForTelegramMenu(cmds).map((c) => c.command)).toEqual([
      "help",
      "start",
      "deploy",
    ]);
  });

  it("excludes skills that do not have telegram:true", () => {
    const cmds = [
      makeEntry("help", "builtin"),
      makeEntry("myskill", "skill", false),
      makeEntry("tgskill", "skill", true),
    ];
    const names = commandsForTelegramMenu(cmds).map((c) => c.command);
    expect(names).toContain("tgskill");
    expect(names).not.toContain("myskill");
  });

  it("hides a built-in when showInMenu is false in the visibility map", () => {
    const cmds = [makeEntry("start", "builtin"), makeEntry("help", "builtin")];
    const visibility = { start: { showInMenu: false } };
    const names = commandsForTelegramMenu(cmds, visibility).map(
      (c) => c.command,
    );
    expect(names).not.toContain("start");
    expect(names).toContain("help");
  });

  it("shows a built-in when showInMenu is true in the visibility map", () => {
    const cmds = [makeEntry("help", "builtin")];
    const visibility = { help: { showInMenu: true } };
    const names = commandsForTelegramMenu(cmds, visibility).map(
      (c) => c.command,
    );
    expect(names).toContain("help");
  });

  it("defaults to visible when a built-in has no entry in the visibility map", () => {
    const cmds = [makeEntry("info", "builtin")];
    const names = commandsForTelegramMenu(cmds, {}).map((c) => c.command);
    expect(names).toContain("info");
  });

  it("always includes project and system commands regardless of visibility map", () => {
    const cmds = [
      makeEntry("deploy", "project"),
      makeEntry("context", "system"),
    ];
    const visibility = {
      deploy: { showInMenu: false },
      context: { showInMenu: false },
    };
    const names = commandsForTelegramMenu(cmds, visibility).map(
      (c) => c.command,
    );
    expect(names).toContain("deploy");
    expect(names).toContain("context");
  });
});

// ─── commandsForHelp ──────────────────────────────────────────────────────────

describe("commandsForHelp", () => {
  it("hides a built-in when showInHelp is false", () => {
    const cmds = [makeEntry("start", "builtin"), makeEntry("help", "builtin")];
    const visibility = { start: { showInHelp: false } };
    const names = commandsForHelp(cmds, visibility).map((c) => c.command);
    expect(names).not.toContain("start");
    expect(names).toContain("help");
  });

  it("shows a built-in when showInHelp is true", () => {
    const cmds = [makeEntry("help", "builtin")];
    const visibility = { help: { showInHelp: true } };
    const names = commandsForHelp(cmds, visibility).map((c) => c.command);
    expect(names).toContain("help");
  });

  it("menu and help visibility are independent", () => {
    const cmds = [makeEntry("model", "builtin")];
    // showInMenu=false but showInHelp=true
    const visibility = { model: { showInMenu: false, showInHelp: true } };
    const menuNames = commandsForTelegramMenu(cmds, visibility).map(
      (c) => c.command,
    );
    const helpNames = commandsForHelp(cmds, visibility).map((c) => c.command);
    expect(menuNames).not.toContain("model");
    expect(helpNames).toContain("model");
  });
});

// ─── sanitizeNpmScriptName ────────────────────────────────────────────────────

describe("sanitizeNpmScriptName", () => {
  it("passes through a simple valid name", () => {
    expect(sanitizeNpmScriptName("build")).toBe("build");
  });

  it("lowercases the name", () => {
    expect(sanitizeNpmScriptName("Build")).toBe("build");
  });

  it("replaces colons with underscores", () => {
    expect(sanitizeNpmScriptName("tunnel:start")).toBe("tunnel_start");
  });

  it("replaces hyphens with underscores", () => {
    expect(sanitizeNpmScriptName("pre-deploy")).toBe("pre_deploy");
  });

  it("collapses consecutive underscores", () => {
    expect(sanitizeNpmScriptName("a--b")).toBe("a_b");
  });

  it("trims leading and trailing underscores", () => {
    expect(sanitizeNpmScriptName(":start:")).toBe("start");
  });

  it("truncates to 32 characters", () => {
    const long = "a".repeat(40);
    const result = sanitizeNpmScriptName(long);
    expect(result?.length).toBeLessThanOrEqual(32);
  });

  it("returns null for an empty result", () => {
    expect(sanitizeNpmScriptName(":::")).toBeNull();
  });
});
