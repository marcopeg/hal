import { readdirSync } from "node:fs";
import { join } from "node:path";
import type pino from "pino";
import { loadMdCron, loadProjectMdCron } from "./loader-md.js";
import { loadMjsCron, loadProjectMjsCron } from "./loader-mjs.js";
import type { CronDefinition, ProjectCronDefinition } from "./types.js";
import type { CronVarsContext } from "./vars.js";

// ─── System-tier loader ───────────────────────────────────────────────────────

export interface LoadDirOptions {
  strict: boolean;
  /** When provided, ${VAR} patterns in .md frontmatter are resolved before parsing. */
  vars?: CronVarsContext;
}

export interface LoadDirResult {
  definitions: CronDefinition[];
  errors: Array<{ file: string; error: string }>;
}

/**
 * Load all .md and .mjs system-tier cron files from a directory.
 *
 * If the directory does not exist, returns an empty result (not an error).
 *
 * @param strict - if true, re-throws the first error encountered (boot mode);
 *                 if false, collects errors and continues (hot-reload mode).
 */
export async function loadCronsFromDir(
  dir: string,
  logger: pino.Logger,
  options: LoadDirOptions,
): Promise<LoadDirResult> {
  let files: string[];
  try {
    files = readdirSync(dir).filter(
      (f) => f.endsWith(".md") || f.endsWith(".mjs"),
    );
  } catch {
    return { definitions: [], errors: [] };
  }

  const definitions: CronDefinition[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      if (file.endsWith(".md")) {
        definitions.push(
          loadMdCron(filePath, { strict: options.strict, vars: options.vars }),
        );
      } else {
        definitions.push(await loadMjsCron(filePath));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (options.strict) {
        throw new Error(message);
      }
      errors.push({ file: filePath, error: message });
      logger.error(
        { file: filePath, error: message },
        "Cron file invalid — skipping",
      );
    }
  }

  return { definitions, errors };
}

// ─── Project-tier loader ──────────────────────────────────────────────────────

export interface LoadProjectDirResult {
  definitions: ProjectCronDefinition[];
  errors: Array<{ file: string; error: string }>;
}

/**
 * Load all .md and .mjs project-tier cron files from a directory.
 *
 * Always non-strict: invalid files are logged and skipped without failing project boot.
 * If the directory does not exist, returns an empty result (not an error).
 */
export async function loadProjectCronsFromDir(
  dir: string,
  logger: pino.Logger,
  options: LoadDirOptions,
): Promise<LoadProjectDirResult> {
  let files: string[];
  try {
    files = readdirSync(dir).filter(
      (f) => f.endsWith(".md") || f.endsWith(".mjs"),
    );
  } catch {
    return { definitions: [], errors: [] };
  }

  const definitions: ProjectCronDefinition[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      if (file.endsWith(".md")) {
        definitions.push(
          loadProjectMdCron(filePath, {
            strict: options.strict,
            vars: options.vars,
          }),
        );
      } else {
        definitions.push(await loadProjectMjsCron(filePath));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Project-tier crons are always non-strict: log and skip, never abort project boot
      errors.push({ file: filePath, error: message });
      logger.error(
        { file: filePath, error: message },
        "Project cron file invalid — skipping",
      );
    }
  }

  return { definitions, errors };
}
