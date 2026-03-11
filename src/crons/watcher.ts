import { mkdirSync } from "node:fs";
import type pino from "pino";
import { loadMdCron, loadProjectMdCron } from "./loader-md.js";
import { loadMjsCron, loadProjectMjsCron } from "./loader-mjs.js";
import type { CronScheduler } from "./scheduler.js";
import type { CronVarsContext } from "./vars.js";

export interface CronWatcher {
  stop: () => Promise<void>;
}

export interface CronWatcherOptions {
  /** "system" uses system-tier loaders; "project" uses project-tier loaders. Default: "system". */
  tier?: "system" | "project";
  /**
   * When provided, ${VAR} patterns in .md frontmatter are resolved on every
   * hot-reload using the same resolution chain as at boot time.
   * Env files (.env.local / .env) are re-read on each reload so changes
   * to env files are picked up without a restart.
   */
  vars?: CronVarsContext;
}

/**
 * Watch a cron directory for file changes and update the scheduler accordingly.
 *
 * - File added   → load and schedule new job
 * - File changed → reload and replace existing job
 * - File deleted → remove job from scheduler
 * - Invalid file → log error, skip (never crashes the process)
 *
 * Follows the same chokidar + debounce pattern as src/bot/commands/watcher.ts.
 */
export function startCronWatcher(
  cronDir: string,
  scheduler: CronScheduler,
  logger: pino.Logger,
  options: CronWatcherOptions = {},
): CronWatcher {
  const tier = options.tier ?? "system";
  const vars = options.vars;
  mkdirSync(cronDir, { recursive: true });

  const DEBOUNCE_MS = 300;
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let watcherInstance: { close: () => Promise<void> } | null = null;

  function scheduleHandle(
    filePath: string,
    event: "add" | "change" | "unlink",
  ): void {
    const existing = debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);
    debounceTimers.set(
      filePath,
      setTimeout(() => {
        debounceTimers.delete(filePath);
        void handleFile(filePath, event);
      }, DEBOUNCE_MS),
    );
  }

  async function handleFile(
    filePath: string,
    event: "add" | "change" | "unlink",
  ): Promise<void> {
    const isRelevant = filePath.endsWith(".md") || filePath.endsWith(".mjs");
    if (!isRelevant) return;

    logger.debug({ filePath, event }, "Cron file event detected");

    if (event === "unlink") {
      const name = (filePath.split("/").pop() ?? "").replace(/\.(md|mjs)$/, "");
      scheduler.remove(name);
      logger.info({ jobName: name, filePath }, "Cron removed (file deleted)");
      return;
    }

    try {
      const def =
        tier === "project"
          ? filePath.endsWith(".md")
            ? loadProjectMdCron(filePath, { strict: false, vars })
            : await loadProjectMjsCron(filePath)
          : filePath.endsWith(".md")
            ? loadMdCron(filePath, { strict: false, vars })
            : await loadMjsCron(filePath);

      if (event === "add") {
        scheduler.add(def);
        logger.info({ jobName: def.name, filePath }, "Cron added (new file)");
      } else {
        scheduler.replace(def);
        logger.info(
          { jobName: def.name, filePath },
          "Cron updated (file changed)",
        );
      }
    } catch (err) {
      logger.error(
        {
          filePath,
          error: err instanceof Error ? err.message : String(err),
        },
        "Cron hot-reload: invalid file — skipping",
      );
    }
  }

  const watcherReady = (async () => {
    try {
      const chokidar = await import("chokidar");
      const watcher = chokidar.watch(cronDir, {
        ignoreInitial: true,
        persistent: true,
      });

      watcher.on("add", (p: string) => scheduleHandle(p, "add"));
      watcher.on("change", (p: string) => scheduleHandle(p, "change"));
      watcher.on("unlink", (p: string) => scheduleHandle(p, "unlink"));
      watcher.on("error", (err: unknown) => {
        logger.error(
          { error: err instanceof Error ? err.message : String(err) },
          "Cron watcher error",
        );
      });

      watcherInstance = watcher;
      logger.debug({ cronDir, tier }, "Cron file watcher started");
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Failed to start cron file watcher",
      );
    }
  })();

  return {
    stop: async () => {
      for (const timer of debounceTimers.values()) clearTimeout(timer);
      debounceTimers.clear();
      await watcherReady;
      if (watcherInstance) {
        await watcherInstance.close();
        watcherInstance = null;
        logger.debug("Cron file watcher stopped");
      }
    },
  };
}
