import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type pino from "pino";
import { parse as parseYaml } from "yaml";
import {
  NpmScriptError,
  readPackageScripts,
  resolveAllowedScripts,
} from "./npm/scripts.js";

/** Telegram API limit for setMyCommands description length (codepoints). */
export const TELEGRAM_MAX_DESCRIPTION_LENGTH = 256;

// ─── Types ──────────────────────────────────────────────────────────────────

export type CommandSource = "builtin" | "git" | "project" | "system" | "skill";

export interface CommandEntry {
  command: string; // name without leading slash (e.g. "deploy")
  description: string; // from file's `description` export
  filePath: string; // absolute path to .mjs or SKILL.md, or "" for built-ins
  skillPrompt?: string; // prompt body from SKILL.md (skills only)
  enabled?: boolean; // routing/publication enabled for project/system commands and skills
  showInMenu?: boolean; // Telegram menu visibility for project/system commands and skills
  showInHelp?: boolean; // HAL help visibility for project/system commands and skills
  source: CommandSource; // where the command comes from
}

interface SurfaceVisibility {
  enabled: boolean;
  showInMenu: boolean;
  showInHelp: boolean;
}

class VisibilityMetadataError extends Error {}

export interface CommandEnabledFlags {
  start: boolean;
  help: boolean;
  reset: boolean;
  clear: boolean;
  info: boolean;
  git: boolean;
  model: boolean;
  engine: boolean;
  npm: boolean;
}

/**
 * Per-command visibility flags for Telegram menu and HAL help.
 * Missing entries default to visible (true).
 */
export type CommandVisibility = Partial<
  Record<string, { showInMenu?: boolean; showInHelp?: boolean }>
>;

/** Options forwarded to npm script derivation in loadCommands. */
export interface NpmCommandOptions {
  whitelist?: string[];
  blacklist?: string[];
  /** When true, show npm-derived entries; otherwise omit even if npm is enabled. */
  showInMenu?: boolean;
  showInHelp?: boolean;
}

// Canonical display/menu order for command sources
const SOURCE_ORDER: Record<CommandSource, number> = {
  project: 0,
  skill: 1,
  system: 2,
  builtin: 3,
  git: 4,
};

function sortBySource(a: CommandEntry, b: CommandEntry): number {
  return SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source];
}

const TELEGRAM_COMMAND_RE = /^[a-z0-9_]{1,32}$/;

function isValidTelegramCommandName(name: string): boolean {
  return TELEGRAM_COMMAND_RE.test(name);
}

/**
 * Returns commands whose description exceeds Telegram's limit (256 chars).
 * Path is relative to configDir for clear error reporting; built-ins show "(builtin)".
 */
export function getCommandsWithDescriptionTooLong(
  commands: CommandEntry[],
  configDir: string,
  maxLength: number = TELEGRAM_MAX_DESCRIPTION_LENGTH,
): { command: string; path: string; length: number }[] {
  const offenders: { command: string; path: string; length: number }[] = [];
  for (const c of commands) {
    const len = c.description.length;
    if (len > maxLength) {
      const path =
        c.filePath === "" ? "(builtin)" : relative(configDir, c.filePath);
      offenders.push({ command: c.command, path, length: len });
    }
  }
  return offenders;
}

// ─── Directory helpers ───────────────────────────────────────────────────────

function projectCommandDir(projectCwd: string): string {
  return join(projectCwd, ".hal", "commands");
}

function globalCommandDir(configDir: string): string {
  return join(configDir, ".hal", "commands");
}

// ─── Single-file import ──────────────────────────────────────────────────────

async function importCommandFile(
  filePath: string,
  logger: pino.Logger,
  source: CommandSource,
): Promise<CommandEntry | null> {
  try {
    // Cache-bust on every import so hot-reload always gets the latest version
    const mod = await import(`${filePath}?t=${Date.now()}`);

    if (typeof mod.description !== "string" || !mod.description.trim()) {
      logger.warn(
        { filePath },
        "Command file missing or empty `description` export — skipping",
      );
      return null;
    }

    // Derive command name from filename (strip .mjs extension)
    const fileName = filePath.split("/").pop() ?? "";
    const command = fileName.replace(/\.mjs$/, "");

    if (!isValidTelegramCommandName(command)) {
      logger.warn(
        { filePath, command },
        "Invalid Telegram command name from filename — skipping",
      );
      return null;
    }

    const visibility = parseCommandVisibility(filePath, mod);

    return {
      command,
      description: mod.description,
      filePath,
      enabled: visibility.enabled,
      showInMenu: visibility.showInMenu,
      showInHelp: visibility.showInHelp,
      source,
    };
  } catch (err) {
    if (err instanceof VisibilityMetadataError) {
      throw err;
    }
    logger.error(
      {
        filePath,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      "Failed to import command file — skipping",
    );
    return null;
  }
}

function parseCommandVisibility(
  filePath: string,
  mod: Record<string, unknown>,
): SurfaceVisibility {
  return {
    enabled: readBooleanExport(filePath, mod, "enabled"),
    showInMenu: readBooleanExport(filePath, mod, "showInMenu"),
    showInHelp: readBooleanExport(filePath, mod, "showInHelp"),
  };
}

function readBooleanExport(
  filePath: string,
  mod: Record<string, unknown>,
  key: keyof SurfaceVisibility,
): boolean {
  const value = mod[key];
  if (value === undefined) {
    return true;
  }
  if (typeof value !== "boolean") {
    throw new VisibilityMetadataError(
      `Invalid ${key} export in ${filePath}: expected boolean`,
    );
  }
  return value;
}

// ─── Directory scan ──────────────────────────────────────────────────────────

async function scanCommandDir(
  dir: string,
  logger: pino.Logger,
  source: CommandSource,
): Promise<CommandEntry[]> {
  if (!existsSync(dir)) {
    return [];
  }

  let files: string[];
  try {
    files = await readdir(dir);
  } catch (err) {
    logger.error(
      { dir, error: err instanceof Error ? err.message : String(err) },
      "Failed to read command directory — skipping",
    );
    return [];
  }

  const mjsFiles = files.filter((f) => f.endsWith(".mjs"));
  const entries: CommandEntry[] = [];

  for (const file of mjsFiles) {
    const filePath = join(dir, file);
    const entry = await importCommandFile(filePath, logger, source);
    if (entry !== null) {
      entries.push(entry);
    }
  }

  return entries;
}

// ─── Skills scan ─────────────────────────────────────────────────────────────

/**
 * Parse a SKILL.md file and return { name, description, prompt }.
 * `prompt` is the body text after the closing frontmatter delimiter.
 * Returns null if the file cannot be parsed or is missing required fields.
 */
async function parseSkillMd(
  filePath: string,
  logger: pino.Logger,
): Promise<{
  name: string;
  description: string;
  prompt: string;
  visibility: SurfaceVisibility;
} | null> {
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (err) {
    logger.error(
      { filePath, error: err instanceof Error ? err.message : String(err) },
      "Failed to read SKILL.md — skipping",
    );
    return null;
  }

  // Match frontmatter block and capture everything after the closing ---
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)/);
  if (!match) {
    logger.warn({ filePath }, "SKILL.md missing frontmatter block — skipping");
    return null;
  }

  const frontmatterRaw = match[1];
  const prompt = match[2].trim();

  let frontmatter: unknown;
  try {
    frontmatter = parseYaml(frontmatterRaw);
  } catch (err) {
    logger.warn(
      { filePath, error: err instanceof Error ? err.message : String(err) },
      "SKILL.md frontmatter is not valid YAML — skipping",
    );
    return null;
  }

  if (
    frontmatter === null ||
    typeof frontmatter !== "object" ||
    Array.isArray(frontmatter)
  ) {
    logger.warn(
      { filePath },
      "SKILL.md frontmatter must be a YAML object — skipping",
    );
    return null;
  }

  const frontmatterObj = frontmatter as Record<string, unknown>;
  const name = frontmatterObj.name;
  const description = frontmatterObj.description;
  if (typeof name !== "string" || !name.trim()) {
    logger.warn(
      { filePath },
      "SKILL.md frontmatter missing name or description — skipping",
    );
    return null;
  }
  if (typeof description !== "string" || !description.trim()) {
    logger.warn(
      { filePath },
      "SKILL.md frontmatter missing name or description — skipping",
    );
    return null;
  }

  return {
    name: name.trim(),
    description: description.trim(),
    prompt,
    visibility: parseSkillTelegramVisibility(filePath, frontmatterObj.telegram),
  };
}

function parseSkillTelegramVisibility(
  filePath: string,
  telegram: unknown,
): SurfaceVisibility {
  if (telegram === undefined) {
    return {
      enabled: false,
      showInMenu: false,
      showInHelp: false,
    };
  }
  if (typeof telegram === "boolean") {
    return {
      enabled: telegram,
      showInMenu: telegram,
      showInHelp: telegram,
    };
  }
  if (
    telegram === null ||
    typeof telegram !== "object" ||
    Array.isArray(telegram)
  ) {
    throw new VisibilityMetadataError(
      `Invalid telegram frontmatter in ${filePath}: expected boolean or object`,
    );
  }

  const allowedKeys = new Set(["enabled", "showInMenu", "showInHelp"]);
  const value = telegram as Record<string, unknown>;
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new VisibilityMetadataError(
        `Invalid telegram frontmatter in ${filePath}: unknown key "${key}"`,
      );
    }
  }

  return {
    enabled: readSkillTelegramBoolean(filePath, value, "enabled"),
    showInMenu: readSkillTelegramBoolean(filePath, value, "showInMenu"),
    showInHelp: readSkillTelegramBoolean(filePath, value, "showInHelp"),
  };
}

function readSkillTelegramBoolean(
  filePath: string,
  value: Record<string, unknown>,
  key: keyof SurfaceVisibility,
): boolean {
  const field = value[key];
  if (field === undefined) {
    return true;
  }
  if (typeof field !== "boolean") {
    throw new VisibilityMetadataError(
      `Invalid telegram.${key} in ${filePath}: expected boolean`,
    );
  }
  return field;
}

/**
 * Scan the engine's skills directory and return a CommandEntry for each skill.
 * The command name is derived from the folder name (how the engine resolves it).
 * A warning is logged when the frontmatter `name` differs from the folder name.
 * filePath is set to SKILL.md for error reporting (e.g. description too long).
 */
async function scanSkillsDir(
  dir: string,
  logger: pino.Logger,
): Promise<CommandEntry[]> {
  if (!existsSync(dir)) {
    return [];
  }

  let folders: string[];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    folders = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    logger.error(
      { dir, error: err instanceof Error ? err.message : String(err) },
      "Failed to read skills directory — skipping",
    );
    return [];
  }

  const skills: CommandEntry[] = [];

  for (const folder of folders) {
    const skillMdPath = join(dir, folder, "SKILL.md");
    if (!existsSync(skillMdPath)) {
      continue;
    }

    const parsed = await parseSkillMd(skillMdPath, logger);
    if (!parsed) {
      continue;
    }

    // Command name is the folder name; warn if frontmatter `name` disagrees
    if (parsed.name !== folder) {
      logger.warn(
        { folder, frontmatterName: parsed.name },
        "Skill frontmatter `name` differs from folder name — using folder name as command",
      );
    }

    if (!isValidTelegramCommandName(folder)) {
      logger.warn(
        { folder, skillMdPath },
        "Invalid Telegram command name from skill folder — skipping",
      );
      continue;
    }

    skills.push({
      command: folder,
      description: parsed.description,
      filePath: skillMdPath,
      skillPrompt: parsed.prompt,
      enabled: parsed.visibility.enabled,
      showInMenu: parsed.visibility.showInMenu,
      showInHelp: parsed.visibility.showInHelp,
      source: "skill",
    });
  }

  return skills;
}

// ─── Built-in commands ───────────────────────────────────────────────────────

export const BUILTIN_COMMANDS: CommandEntry[] = [
  {
    command: "start",
    description: "Welcome message",
    filePath: "",
    enabled: true,
    showInMenu: true,
    showInHelp: true,
    source: "builtin",
  },
  {
    command: "help",
    description: "Show help",
    filePath: "",
    enabled: true,
    showInMenu: true,
    showInHelp: true,
    source: "builtin",
  },
  {
    command: "reset",
    description: "Wipes out all user data and resets the LLM session",
    filePath: "",
    enabled: true,
    showInMenu: true,
    showInHelp: true,
    source: "builtin",
  },
  {
    command: "clear",
    description: "Resets the LLM session",
    filePath: "",
    enabled: true,
    showInMenu: true,
    showInHelp: true,
    source: "builtin",
  },
  {
    command: "info",
    description: "Show project runtime info",
    filePath: "",
    enabled: true,
    showInMenu: true,
    showInHelp: true,
    source: "builtin",
  },
  {
    command: "model",
    description: "Switch the AI model",
    filePath: "",
    enabled: true,
    showInMenu: true,
    showInHelp: true,
    source: "builtin",
  },
  {
    command: "engine",
    description: "Switch the AI engine",
    filePath: "",
    enabled: true,
    showInMenu: true,
    showInHelp: true,
    source: "builtin",
  },
];

/**
 * Sanitize an npm script name into a valid Telegram command name (lowercase,
 * non-alphanumeric chars replaced with underscores, truncated to 32 chars).
 * Returns null when the result is empty or otherwise invalid.
 */
export function sanitizeNpmScriptName(scriptName: string): string | null {
  const sanitized = scriptName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  if (!sanitized || !TELEGRAM_COMMAND_RE.test(sanitized)) return null;
  return sanitized;
}

export const GIT_COMMANDS: CommandEntry[] = [
  {
    command: "git_init",
    description: "Initialize a git repository",
    filePath: "",
    enabled: true,
    showInMenu: true,
    showInHelp: true,
    source: "git",
  },
  {
    command: "git_status",
    description: "Show git status",
    filePath: "",
    enabled: true,
    showInMenu: true,
    showInHelp: true,
    source: "git",
  },
  {
    command: "git_commit",
    description: "Commit changes",
    filePath: "",
    enabled: true,
    showInMenu: true,
    showInHelp: true,
    source: "git",
  },
  {
    command: "git_clean",
    description: "Revert uncommitted changes",
    filePath: "",
    enabled: true,
    showInMenu: true,
    showInHelp: true,
    source: "git",
  },
];

const BUILTIN_ENABLED_MAP: Record<string, keyof CommandEnabledFlags> = {
  start: "start",
  help: "help",
  reset: "reset",
  clear: "clear",
  info: "info",
  model: "model",
  engine: "engine",
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Scan command directories and optionally the skills dir, then return the merged list.
 * When `enabled` flags are provided, disabled built-in/git commands are excluded.
 * When `npmOpts` is provided and npm is enabled, npm-derived script entries are appended
 * for each allowed script name that doesn't conflict with a higher-precedence command.
 *
 * Precedence (lowest → highest):
 *   npm scripts  <  engine skills  <  global .hal/commands  <  project .hal/commands
 */
export async function loadCommands(
  projectCwd: string,
  configDir: string,
  logger: pino.Logger,
  skillsDirs?: string[],
  enabled?: CommandEnabledFlags,
  npmOpts?: NpmCommandOptions,
): Promise<CommandEntry[]> {
  const globalDir = globalCommandDir(configDir);
  const projectDir = projectCommandDir(projectCwd);

  // Scan all skill directories in priority order, dedup by name (first-found wins)
  const skillEntries: CommandEntry[] = [];
  const seenSkills = new Set<string>();
  if (skillsDirs) {
    for (const dir of skillsDirs) {
      const dirSkills = await scanSkillsDir(dir, logger);
      for (const skill of dirSkills) {
        if (skill.enabled === true && !seenSkills.has(skill.command)) {
          seenSkills.add(skill.command);
          skillEntries.push(skill);
        }
      }
    }
  }
  const globalEntries = await scanCommandDir(globalDir, logger, "system");
  const projectEntries = await scanCommandDir(projectDir, logger, "project");

  const map = new Map<string, CommandEntry>();

  for (const entry of BUILTIN_COMMANDS) {
    map.set(entry.command, entry);
  }

  if (enabled?.git) {
    for (const entry of GIT_COMMANDS) {
      map.set(entry.command, entry);
    }
  }

  for (const entry of skillEntries) {
    map.set(entry.command, entry);
  }
  for (const entry of globalEntries) {
    if (entry.enabled !== false) {
      map.set(entry.command, entry);
    }
  }
  for (const entry of projectEntries) {
    if (entry.enabled !== false) {
      map.set(entry.command, entry);
    }
  }

  if (enabled) {
    for (const [cmd, flag] of Object.entries(BUILTIN_ENABLED_MAP)) {
      if (!enabled[flag]) {
        map.delete(cmd);
      }
    }
  }

  // Derive npm script entries when npm is enabled.
  // package.json is the source of truth for available scripts; the whitelist
  // filters that set and warns about entries that don't exist in package.json.
  // Only add a script entry when the sanitized name is not already occupied by a
  // higher-precedence command (custom command, skill, or enabled built-in).
  if (enabled?.npm && npmOpts) {
    try {
      const scripts = readPackageScripts(projectCwd);
      const available = Object.keys(scripts);
      const allowed = resolveAllowedScripts(
        available,
        npmOpts.whitelist,
        npmOpts.blacklist,
      );

      // Warn about whitelist entries that don't exist in package.json
      if (npmOpts.whitelist) {
        for (const entry of npmOpts.whitelist) {
          if (!available.includes(entry)) {
            logger.warn(
              { script: entry, cwd: projectCwd },
              "npm whitelist entry not found in package.json — skipping",
            );
          }
        }
      }

      for (const script of allowed) {
        const cmdName = sanitizeNpmScriptName(script);
        if (cmdName && !map.has(cmdName)) {
          map.set(cmdName, {
            command: cmdName,
            description: `npm run ${script}`,
            filePath: "",
            enabled: true,
            showInMenu: npmOpts.showInMenu ?? true,
            showInHelp: npmOpts.showInHelp ?? true,
            source: "builtin",
          });
        }
      }
    } catch (err) {
      if (!(err instanceof NpmScriptError)) {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          "Unexpected error reading npm scripts for command list — skipping",
        );
      }
      // NpmScriptError (missing/empty package.json) → silent omission
    }
  }

  return Array.from(map.values()).sort(sortBySource);
}

/**
 * Return the subset of commands that should be shown in the Telegram slash menu.
 * - Built-in/git commands are filtered by visibility config when present.
 * - Project/system/skill commands use their normalized per-entry visibility flags.
 */
export function commandsForTelegramMenu(
  commands: CommandEntry[],
  visibility?: CommandVisibility,
): CommandEntry[] {
  return commands.filter((c) => {
    if (
      c.source === "project" ||
      c.source === "system" ||
      c.source === "skill"
    ) {
      return c.showInMenu !== false;
    }
    if (c.source === "builtin" || c.source === "git") {
      if (visibility) {
        const configured = visibility[c.command]?.showInMenu;
        if (configured !== undefined) {
          return configured !== false;
        }
      }
      if (c.showInMenu !== undefined) {
        return c.showInMenu !== false;
      }
    }
    return true;
  });
}

/**
 * Return the subset of commands that should be shown in HAL help output (${HAL_COMMANDS}).
 * - Built-in/git commands are filtered by visibility config when present.
 * - Project/system/skill commands use their normalized per-entry visibility flags.
 */
export function commandsForHelp(
  commands: CommandEntry[],
  visibility?: CommandVisibility,
): CommandEntry[] {
  return commands.filter((c) => {
    if (
      c.source === "project" ||
      c.source === "system" ||
      c.source === "skill"
    ) {
      return c.showInHelp !== false;
    }
    if (c.source === "builtin" || c.source === "git") {
      if (visibility) {
        const configured = visibility[c.command]?.showInHelp;
        if (configured !== undefined) {
          return configured !== false;
        }
      }
      if (c.showInHelp !== undefined) {
        return c.showInHelp !== false;
      }
    }
    return true;
  });
}

/**
 * Resolve a skill entry by command name from the engine's skills directory.
 * Returns null if the skill doesn't exist or its SKILL.md can't be parsed.
 */
export async function resolveSkillEntry(
  commandName: string,
  skillsDirs: string[],
  logger: pino.Logger,
): Promise<CommandEntry | null> {
  if (!isValidTelegramCommandName(commandName)) {
    return null;
  }

  for (const dir of skillsDirs) {
    const skillMdPath = join(dir, commandName, "SKILL.md");
    if (!existsSync(skillMdPath)) {
      continue;
    }

    const parsed = await parseSkillMd(skillMdPath, logger);
    if (!parsed) {
      continue;
    }

    if (parsed.name !== commandName) {
      logger.warn(
        { commandName, frontmatterName: parsed.name },
        "Skill frontmatter `name` differs from folder name — using folder name as command",
      );
    }

    return {
      command: commandName,
      description: parsed.description,
      filePath: skillMdPath,
      skillPrompt: parsed.prompt,
      enabled: parsed.visibility.enabled,
      showInMenu: parsed.visibility.showInMenu,
      showInHelp: parsed.visibility.showInHelp,
      source: "skill",
    };
  }

  return null;
}

/**
 * Resolve the file path for a single command name.
 * Returns null if not found in either directory.
 * Project-specific takes precedence over global.
 */
export function resolveCommandPath(
  commandName: string,
  projectCwd: string,
  configDir: string,
): Promise<string | null> {
  return resolveEnabledCommandPath(commandName, projectCwd, configDir);
}

async function resolveEnabledCommandPath(
  commandName: string,
  projectCwd: string,
  configDir: string,
): Promise<string | null> {
  const projectPath = join(projectCommandDir(projectCwd), `${commandName}.mjs`);
  if (existsSync(projectPath)) {
    const mod = await import(`${projectPath}?t=${Date.now()}`);
    const visibility = parseCommandVisibility(projectPath, mod);
    if (visibility.enabled) {
      return projectPath;
    }
  }

  const globalPath = join(globalCommandDir(configDir), `${commandName}.mjs`);
  if (existsSync(globalPath)) {
    const mod = await import(`${globalPath}?t=${Date.now()}`);
    const visibility = parseCommandVisibility(globalPath, mod);
    if (visibility.enabled) {
      return globalPath;
    }
  }

  return null;
}
