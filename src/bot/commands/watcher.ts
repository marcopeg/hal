import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Bot } from "grammy";
import type pino from "pino";
import {
  type CommandEnabledFlags,
  commandsForTelegramMenu,
  getCommandsWithDescriptionTooLong,
  loadCommands,
} from "./loader.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CommandWatcher {
  stop: () => Promise<void>;
}

// ─── Implementation ──────────────────────────────────────────────────────────

/**
 * Start a file watcher that monitors command directories and the skills dir,
 * then re-publishes the full merged command list to Telegram on any change.
 */
export function startCommandWatcher(
  bot: Bot,
  projectCwd: string,
  configDir: string,
  logger: pino.Logger,
  skillsDirs?: string[],
  enabled?: CommandEnabledFlags,
): CommandWatcher {
  const projectCommandDir = join(projectCwd, ".hal", "commands");
  const globalCommandDir = join(configDir, ".hal", "commands");

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function republish(): Promise<void> {
    try {
      const commands = await loadCommands(
        projectCwd,
        configDir,
        logger,
        skillsDirs,
        enabled,
      );
      const commandsForMenu = commandsForTelegramMenu(commands);
      const tooLong = getCommandsWithDescriptionTooLong(
        commandsForMenu,
        configDir,
      );
      if (tooLong.length > 0) {
        const details = tooLong
          .map(
            (o) =>
              `  /${o.command}: description length ${o.length} (max 256) — ${o.path}`,
          )
          .join("\n");
        logger.error(
          { offenders: tooLong },
          `Command description(s) exceed Telegram's 256-character limit:\n${details}`,
        );
        return;
      }
      await bot.api.setMyCommands(
        commandsForMenu.map((c) => ({
          command: c.command,
          description: c.description,
        })),
      );
      logger.info(
        {
          count: commandsForMenu.length,
          commands: commandsForMenu.map((c) => c.command),
        },
        "Commands re-registered with Telegram",
      );
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Failed to re-register commands with Telegram",
      );
    }
  }

  function scheduleRepublish(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void republish();
    }, 300);
  }

  // Dynamically import chokidar to start watching
  // We do this in an async IIFE so we can use await
  let watcherInstance: { close: () => Promise<void> } | null = null;

  const watcherReady = (async () => {
    try {
      const chokidar = await import("chokidar");

      // Do not create .hal directories at boot.
      // Only watch command/skill directories that already exist to avoid polluting project folders.
      const watchPaths: string[] = [];
      if (existsSync(projectCommandDir)) watchPaths.push(projectCommandDir);
      if (existsSync(globalCommandDir)) watchPaths.push(globalCommandDir);
      if (skillsDirs) {
        for (const dir of skillsDirs) {
          if (existsSync(dir)) watchPaths.push(dir);
        }
      }

      if (watchPaths.length === 0) {
        logger.debug(
          { projectCommandDir, globalCommandDir, skillsDirs },
          "No existing command/skill directories to watch",
        );
        return;
      }

      const watcher = chokidar.watch(watchPaths, {
        ignoreInitial: true,
        persistent: true,
        ignored: (path: string) => {
          const basename = path.split("/").pop() ?? "";
          // Allow directories (no extension), .mjs files, and SKILL.md files
          return (
            basename.includes(".") &&
            !basename.endsWith(".mjs") &&
            basename !== "SKILL.md"
          );
        },
      });

      function isRelevant(filePath: string): boolean {
        return filePath.endsWith(".mjs") || filePath.endsWith("SKILL.md");
      }

      watcher.on("add", (filePath: string) => {
        if (isRelevant(filePath)) {
          logger.debug({ filePath }, "Command/skill file added");
          scheduleRepublish();
        }
      });

      watcher.on("change", (filePath: string) => {
        if (isRelevant(filePath)) {
          logger.debug({ filePath }, "Command/skill file changed");
          scheduleRepublish();
        }
      });

      watcher.on("unlink", (filePath: string) => {
        if (isRelevant(filePath)) {
          logger.debug({ filePath }, "Command/skill file removed");
          scheduleRepublish();
        }
      });

      watcher.on("error", (err: unknown) => {
        logger.error(
          { error: err instanceof Error ? err.message : String(err) },
          "Command watcher error",
        );
      });

      watcherInstance = watcher;
      logger.debug(
        { projectCommandDir, globalCommandDir, skillsDirs },
        "Command watcher started",
      );
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Failed to start command watcher",
      );
    }
  })();

  return {
    stop: async () => {
      // Cancel any pending debounce
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      // Wait for watcher to be ready before closing
      await watcherReady;
      if (watcherInstance !== null) {
        await watcherInstance.close();
        watcherInstance = null;
        logger.debug("Command watcher stopped");
      }
    },
  };
}
