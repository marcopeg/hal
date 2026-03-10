import { readdirSync } from "node:fs";
import { join } from "node:path";
import type pino from "pino";
import { loadMdCron } from "./loader-md.js";
import { loadMjsCron } from "./loader-mjs.js";
import type { CronDefinition } from "./types.js";

export interface LoadDirResult {
  definitions: CronDefinition[];
  errors: Array<{ file: string; error: string }>;
}

/**
 * Load all .md and .mjs cron files from a directory.
 *
 * If the directory does not exist, returns an empty result (not an error).
 *
 * @param strict - if true, re-throws the first error encountered (boot mode);
 *                 if false, collects errors and continues (hot-reload mode).
 */
export async function loadCronsFromDir(
  dir: string,
  logger: pino.Logger,
  options: { strict: boolean },
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
        definitions.push(loadMdCron(filePath, { strict: options.strict }));
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
