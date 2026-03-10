import { join } from "node:path";
import type { Bot } from "grammy";
import type pino from "pino";
import type { ProjectContext } from "../types.js";
import { buildCronContext } from "./context.js";
import { loadCronsFromDir } from "./loader-dir.js";
import { CronScheduler } from "./scheduler.js";
import type { CronHandle } from "./types.js";
import { startCronWatcher } from "./watcher.js";

export interface StartSystemCronsOptions {
  configDir: string;
  multiConfig: Record<string, unknown>;
  /** Map of project slug → { projectCtx, bot } */
  projects: Record<string, { projectCtx: ProjectContext; bot: Bot }>;
  logger: pino.Logger;
}

/**
 * Load, validate, and schedule all system-level cron files from
 * {configDir}/.hal/crons/. Starts a file watcher for hot reload.
 *
 * Throws on the first invalid file at boot (strict mode).
 * Returns a handle that stops the scheduler and the file watcher.
 */
export async function startSystemCrons(
  options: StartSystemCronsOptions,
): Promise<CronHandle> {
  const { configDir, multiConfig, projects, logger } = options;
  const cronDir = join(configDir, ".hal", "crons");

  const { cronCtx, internalProjectCtxs } = buildCronContext(
    multiConfig,
    projects,
  );

  const { definitions } = await loadCronsFromDir(cronDir, logger, {
    strict: true,
  });
  logger.info({ count: definitions.length }, "System crons loaded");

  const scheduler = new CronScheduler(
    cronCtx,
    internalProjectCtxs,
    configDir,
    logger,
  );
  scheduler.load(definitions);

  const watcher = startCronWatcher(cronDir, scheduler, logger);

  return {
    stop: async () => {
      await watcher.stop();
      scheduler.stop();
      logger.info("System cron scheduler stopped");
    },
  };
}

export { buildCronContext } from "./context.js";
export { loadCronsFromDir } from "./loader-dir.js";
export { CronScheduler } from "./scheduler.js";
// Re-export for use by 032b/032c
export type { CronContext, CronDefinition, CronHandle } from "./types.js";
export { startCronWatcher } from "./watcher.js";
