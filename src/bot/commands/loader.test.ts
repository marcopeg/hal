import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandEntry } from "./loader.js";
import {
  commandsForHelp,
  commandsForTelegramMenu,
  loadCommands,
  resolveCommandPath,
  resolveSkillEntry,
  sanitizeNpmScriptName,
} from "./loader.js";

const tempDirs: string[] = [];

const logger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as never;

async function makeWorkspace(): Promise<{
  projectCwd: string;
  configDir: string;
  skillsDir: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "hal-loader-"));
  tempDirs.push(root);

  const projectCwd = join(root, "project");
  const configDir = join(root, "config");
  const skillsDir = join(root, "skills");

  await mkdir(projectCwd, { recursive: true });
  await mkdir(configDir, { recursive: true });
  await mkdir(skillsDir, { recursive: true });

  return { projectCwd, configDir, skillsDir };
}

async function writeProjectCommand(
  projectCwd: string,
  name: string,
  source: string,
): Promise<string> {
  const dir = join(projectCwd, ".hal", "commands");
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${name}.mjs`);
  await writeFile(filePath, source, "utf8");
  return filePath;
}

async function writeGlobalCommand(
  configDir: string,
  name: string,
  source: string,
): Promise<string> {
  const dir = join(configDir, ".hal", "commands");
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${name}.mjs`);
  await writeFile(filePath, source, "utf8");
  return filePath;
}

async function writeSkill(
  skillsDir: string,
  name: string,
  frontmatter: string,
  prompt = "Prompt body",
): Promise<string> {
  const dir = join(skillsDir, name);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, "SKILL.md");
  await writeFile(filePath, `---\n${frontmatter}\n---\n${prompt}\n`, "utf8");
  return filePath;
}

function makeEntry(
  command: string,
  source: CommandEntry["source"],
  overrides: Partial<CommandEntry> = {},
): CommandEntry {
  return {
    command,
    description: `${command} desc`,
    filePath: "",
    source,
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
  vi.clearAllMocks();
});

describe("commandsForTelegramMenu", () => {
  it("includes project/system commands by default", () => {
    const cmds = [
      makeEntry("deploy", "project", { showInMenu: true }),
      makeEntry("context", "system", { showInMenu: true }),
    ];

    expect(commandsForTelegramMenu(cmds).map((c) => c.command)).toEqual([
      "deploy",
      "context",
    ]);
  });

  it("filters project/system/skill entries by their own showInMenu flags", () => {
    const cmds = [
      makeEntry("deploy", "project", { showInMenu: false }),
      makeEntry("context", "system", { showInMenu: true }),
      makeEntry("todo", "skill", { showInMenu: false }),
      makeEntry("notes", "skill", { showInMenu: true }),
    ];

    expect(commandsForTelegramMenu(cmds).map((c) => c.command)).toEqual([
      "context",
      "notes",
    ]);
  });

  it("still applies visibility config to built-ins", () => {
    const cmds = [makeEntry("start", "builtin"), makeEntry("help", "builtin")];
    const visibility = { start: { showInMenu: false } };

    expect(
      commandsForTelegramMenu(cmds, visibility).map((c) => c.command),
    ).toEqual(["help"]);
  });
});

describe("commandsForHelp", () => {
  it("filters project/system/skill entries by their own showInHelp flags", () => {
    const cmds = [
      makeEntry("deploy", "project", { showInHelp: false }),
      makeEntry("context", "system", { showInHelp: true }),
      makeEntry("todo", "skill", { showInHelp: false }),
      makeEntry("notes", "skill", { showInHelp: true }),
    ];

    expect(commandsForHelp(cmds).map((c) => c.command)).toEqual([
      "context",
      "notes",
    ]);
  });

  it("menu and help visibility remain independent", () => {
    const cmds = [
      makeEntry("todo", "skill", { showInMenu: false, showInHelp: true }),
    ];

    expect(commandsForTelegramMenu(cmds).map((c) => c.command)).toEqual([]);
    expect(commandsForHelp(cmds).map((c) => c.command)).toEqual(["todo"]);
  });
});

describe("loadCommands", () => {
  it("falls through to an enabled same-name skill when the project command is disabled", async () => {
    const { projectCwd, configDir, skillsDir } = await makeWorkspace();

    await writeProjectCommand(
      projectCwd,
      "todo",
      `
        export const description = "Todo command";
        export const enabled = false;
        export default async function () {}
      `,
    );
    await writeSkill(
      skillsDir,
      "todo",
      `
name: todo
description: Todo skill
telegram: true
      `,
    );

    const commands = await loadCommands(
      projectCwd,
      configDir,
      logger,
      [skillsDir],
      undefined,
      undefined,
    );

    const todo = commands.find((entry) => entry.command === "todo");
    expect(todo).toMatchObject({
      command: "todo",
      description: "Todo skill",
      source: "skill",
      enabled: true,
      showInMenu: true,
      showInHelp: true,
    });
  });

  it("keeps an enabled project command as the visible same-name surface", async () => {
    const { projectCwd, configDir, skillsDir } = await makeWorkspace();

    await writeProjectCommand(
      projectCwd,
      "todo",
      `
        export const description = "Todo command";
        export default async function () {}
      `,
    );
    await writeSkill(
      skillsDir,
      "todo",
      `
name: todo
description: Todo skill
telegram: true
      `,
    );

    const commands = await loadCommands(
      projectCwd,
      configDir,
      logger,
      [skillsDir],
      undefined,
      undefined,
    );

    expect(commands.find((entry) => entry.command === "todo")).toMatchObject({
      description: "Todo command",
      source: "project",
    });
  });

  it("supports skill telegram object form", async () => {
    const { projectCwd, configDir, skillsDir } = await makeWorkspace();

    await writeSkill(
      skillsDir,
      "todo",
      `
name: todo
description: Todo skill
telegram:
  enabled: true
  showInMenu: false
  showInHelp: true
      `,
    );

    const commands = await loadCommands(
      projectCwd,
      configDir,
      logger,
      [skillsDir],
      undefined,
      undefined,
    );

    expect(
      commandsForTelegramMenu(commands).map((c) => c.command),
    ).not.toContain("todo");
    expect(commandsForHelp(commands).map((c) => c.command)).toContain("todo");
  });

  it("omits telegram:false skills from the Telegram command surfaces", async () => {
    const { projectCwd, configDir, skillsDir } = await makeWorkspace();

    await writeSkill(
      skillsDir,
      "todo",
      `
name: todo
description: Todo skill
telegram: false
      `,
    );

    const commands = await loadCommands(
      projectCwd,
      configDir,
      logger,
      [skillsDir],
      undefined,
      undefined,
    );

    expect(commands.some((entry) => entry.command === "todo")).toBe(false);
  });

  it("throws on invalid command visibility export types", async () => {
    const { projectCwd, configDir, skillsDir } = await makeWorkspace();

    await writeProjectCommand(
      projectCwd,
      "todo",
      `
        export const description = "Todo command";
        export const enabled = "yes";
        export default async function () {}
      `,
    );

    await expect(
      loadCommands(
        projectCwd,
        configDir,
        logger,
        [skillsDir],
        undefined,
        undefined,
      ),
    ).rejects.toThrow(/Invalid enabled export/);
  });

  it("throws on invalid skill telegram object keys", async () => {
    const { projectCwd, configDir, skillsDir } = await makeWorkspace();

    await writeSkill(
      skillsDir,
      "todo",
      `
name: todo
description: Todo skill
telegram:
  enabled: true
  menu: true
      `,
    );

    await expect(
      loadCommands(
        projectCwd,
        configDir,
        logger,
        [skillsDir],
        undefined,
        undefined,
      ),
    ).rejects.toThrow(/unknown key "menu"/);
  });
});

describe("resolveSkillEntry", () => {
  it("returns normalized object-form skill visibility", async () => {
    const { skillsDir } = await makeWorkspace();

    await writeSkill(
      skillsDir,
      "todo",
      `
name: todo
description: Todo skill
telegram:
  enabled: true
  showInMenu: false
  showInHelp: true
      `,
    );

    await expect(
      resolveSkillEntry("todo", [skillsDir], logger),
    ).resolves.toMatchObject({
      enabled: true,
      showInMenu: false,
      showInHelp: true,
      source: "skill",
    });
  });

  it("returns disabled visibility for telegram:false", async () => {
    const { skillsDir } = await makeWorkspace();

    await writeSkill(
      skillsDir,
      "todo",
      `
name: todo
description: Todo skill
telegram: false
      `,
    );

    await expect(
      resolveSkillEntry("todo", [skillsDir], logger),
    ).resolves.toMatchObject({
      enabled: false,
      showInMenu: false,
      showInHelp: false,
    });
  });
});

describe("resolveCommandPath", () => {
  it("returns null for a disabled project command and falls through to global", async () => {
    const { projectCwd, configDir } = await makeWorkspace();

    await writeProjectCommand(
      projectCwd,
      "todo",
      `
        export const description = "Project todo";
        export const enabled = false;
        export default async function () {}
      `,
    );
    const globalPath = await writeGlobalCommand(
      configDir,
      "todo",
      `
        export const description = "Global todo";
        export default async function () {}
      `,
    );

    await expect(
      resolveCommandPath("todo", projectCwd, configDir),
    ).resolves.toBe(globalPath);
  });
});

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
