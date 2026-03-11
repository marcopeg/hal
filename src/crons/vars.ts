import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseEnv } from "dotenv";

/**
 * Variable substitution context for ${VAR} resolution in .md cron frontmatter.
 *
 * Resolution order:
 *   System crons:  ctx → .env.local (configDir) → .env (configDir) → process.env
 *   Project crons: ctx → .env.local (projectCwd) → .env (projectCwd)
 *                      → .env.local (configDir)  → .env (configDir)  → process.env
 *
 * Env dirs are listed in priority order (first = highest priority).
 */
export interface CronVarsContext {
  /** Static context vars from HAL config (config.context + bootContext.shellCache). */
  ctx: Record<string, string>;
  /** Directories to read .env.local and .env from, in priority order. */
  envDirs: string[];
}

/** Read a .env or .env.local file. Returns {} if the file does not exist or cannot be read. */
function readEnvFile(filePath: string): Record<string, string> {
  try {
    return parseEnv(readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

/**
 * Replace ${VAR} patterns in a raw frontmatter string using the resolution chain.
 *
 * First match wins. If a var cannot be resolved from any source, the pattern
 * is left as-is — Zod validation will then fail with a clear error message
 * indicating which value could not be resolved.
 */
export function substituteVars(raw: string, vars: CronVarsContext): string {
  // Build ordered sources lazily (env files are read on each call so hot-reload
  // picks up changes to .env files without a restart)
  const sources: Record<string, string | undefined>[] = [vars.ctx];
  for (const dir of vars.envDirs) {
    sources.push(readEnvFile(join(dir, ".env.local")));
    sources.push(readEnvFile(join(dir, ".env")));
  }
  sources.push(process.env as Record<string, string | undefined>);

  return raw.replace(/\$\{([^}]+)\}/g, (match, key: string) => {
    for (const source of sources) {
      if (source[key] !== undefined) return source[key]!;
    }
    return match; // unresolved — leave as-is
  });
}
