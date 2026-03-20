import { Bot } from "grammy";
import { createEngineHandler } from "./bot/commands/engine.js";
import { createEngineCallbackHandler } from "./bot/commands/engine-callback.js";
import {
  createGitCallbackHandler,
  createGitCleanHandler,
  createGitCommitHandler,
  createGitInitHandler,
  createGitStatusHandler,
} from "./bot/commands/git/index.js";
import { createHelpHandler } from "./bot/commands/help.js";
import { createInfoHandler } from "./bot/commands/info.js";
import {
  type CommandEnabledFlags,
  type CommandVisibility,
  commandsForTelegramMenu,
  getCommandsWithDescriptionTooLong,
  loadCommands,
} from "./bot/commands/loader.js";
import { createModelHandler } from "./bot/commands/model.js";
import { createModelCallbackHandler } from "./bot/commands/model-callback.js";
import {
  createNpmCallbackHandler,
  createNpmHandler,
} from "./bot/commands/npm/index.js";
import {
  createResetCallbackHandler,
  createResetHandler,
} from "./bot/commands/reset.js";
import { clearAllPrompts } from "./bot/commands/resetPrompt.js";
import { createClearHandler } from "./bot/commands/session.js";
import { createStartHandler } from "./bot/commands/start.js";
import { startCommandWatcher } from "./bot/commands/watcher.js";
import {
  createDocumentHandler,
  createMjsCallbackDispatcher,
  createPhotoHandler,
  createTextHandler,
  createVoiceCallbackHandler,
  createVoiceHandler,
} from "./bot/handlers/index.js";
import { expirePending, getPending } from "./bot/handlers/voice-pending.js";
import { createAuthMiddleware } from "./bot/middleware/auth.js";
import { createRateLimitMiddleware } from "./bot/middleware/rateLimit.js";
import type { ProjectContext } from "./types.js";

export interface BotHandle {
  stop: () => Promise<void>;
  /** The Grammy Bot instance for this project. Used by the cron scheduler to send messages. */
  bot: Bot;
}

/**
 * Start a single bot for one project context.
 * Resolves when the bot is fully running; rejects if startup fails.
 * Returns a handle with a stop() function for graceful shutdown.
 */
export async function startBot(projectCtx: ProjectContext): Promise<BotHandle> {
  const { config, logger, engine } = projectCtx;

  logger.info({ cwd: config.cwd, dataDir: config.dataDir }, "Starting bot");

  // Verify the engine CLI is available (throws on failure)
  logger.debug(
    { engine: config.engine, command: engine.command },
    "Checking engine CLI",
  );
  engine.check();
  logger.info(
    { engine: config.engine, command: engine.command },
    "Engine CLI verified",
  );

  const bot = new Bot(config.telegram.botToken);

  const debounceActiveUsers = new Set<number>();

  // Wire per-bot middleware
  const { middleware: rateLimitMw, cleanup: rateLimitCleanup } =
    createRateLimitMiddleware(projectCtx, debounceActiveUsers);
  bot.use(createAuthMiddleware(projectCtx));
  bot.use(rateLimitMw);

  // Wire commands (only when enabled)
  const cmd = config.commands;
  if (cmd.start.enabled) bot.command("start", createStartHandler(projectCtx));
  if (cmd.help.enabled) bot.command("help", createHelpHandler(projectCtx));
  if (cmd.reset.enabled) {
    bot.command("reset", createResetHandler(projectCtx, bot.api));
    bot.on("callback_query:data", createResetCallbackHandler(projectCtx));
  }
  if (cmd.clear.enabled) bot.command("clear", createClearHandler(projectCtx));
  if (cmd.info.enabled) bot.command("info", createInfoHandler(projectCtx));

  if (cmd.git.enabled) {
    bot.command("git_init", createGitInitHandler(projectCtx));
    bot.command("git_status", createGitStatusHandler(projectCtx));
    bot.command("git_commit", createGitCommitHandler(projectCtx));
    bot.command("git_clean", createGitCleanHandler(projectCtx));
    bot.on("callback_query:data", createGitCallbackHandler(projectCtx));
  }

  // Keep /npm as a direct launcher even when individual script entries replace it
  // in the menu — users who type /npm still get the script-picker keyboard.
  if (cmd.npm.enabled) {
    bot.command("npm", createNpmHandler(projectCtx));
    bot.on("callback_query:data", createNpmCallbackHandler(projectCtx));
  }

  // Disabled built-ins do NOT get bot.hears interceptors — they fall through to
  // the text handler which routes to project custom commands, then global custom
  // commands, then skills, and finally the agent.
  if (cmd.model.enabled) {
    bot.command("model", createModelHandler(projectCtx));
    bot.on("callback_query:data", createModelCallbackHandler(projectCtx));
  }

  if (cmd.engine.enabled) {
    bot.command("engine", createEngineHandler(projectCtx));
    bot.on("callback_query:data", createEngineCallbackHandler(projectCtx));
  }

  // Answer stale inline-keyboard callbacks for /model and /engine when those
  // commands are currently disabled, so the UI doesn't hang indefinitely.
  bot.on("callback_query:data", async (ctx, next) => {
    const data = ctx.callbackQuery?.data ?? "";
    const engineDisabled = data.startsWith("en:") && !cmd.engine.enabled;
    const modelDisabled = data.startsWith("md:") && !cmd.model.enabled;
    if (engineDisabled || modelDisabled) {
      await ctx.answerCallbackQuery({ text: "This command is disabled." });
      return;
    }
    return next();
  });

  bot.on("callback_query:data", createVoiceCallbackHandler(projectCtx));

  // Generic callback dispatcher for .mjs commands that export `callbackHandler`
  bot.on("callback_query:data", createMjsCallbackDispatcher(projectCtx));

  // Expire pending voice confirmations if a new message arrives from the same user.
  bot.on("message", async (ctx, next) => {
    const userId = ctx.from?.id;
    if (userId && getPending(userId)) {
      await expirePending(userId, ctx.api);
    }
    return next();
  });

  // Wire handlers
  bot.on("message:text", createTextHandler(projectCtx, debounceActiveUsers));
  bot.on("message:photo", createPhotoHandler(projectCtx));
  bot.on("message:document", createDocumentHandler(projectCtx));
  bot.on("message:voice", createVoiceHandler(projectCtx));

  // Error handler
  bot.catch((err) => {
    logger.error({ error: err.error, ctx: err.ctx?.update }, "Bot error");
  });

  // Signal when the bot has started (or failed to start)
  let resolveStarted: () => void;
  let rejectStarted: (err: unknown) => void;
  const startedPromise = new Promise<void>((res, rej) => {
    resolveStarted = res;
    rejectStarted = rej;
  });

  // Start bot — runs until stopped, do not await here
  const runningPromise = bot
    .start({
      onStart: (botInfo) => {
        logger.info(
          { username: botInfo.username, slug: config.slug },
          "Bot is running",
        );
        resolveStarted();
      },
    })
    .catch((err) => {
      rejectStarted(err);
    });

  // Wait until the bot reports it's running (or fails)
  await startedPromise;

  // Derive enabled flags from resolved config
  const enabledFlags: CommandEnabledFlags = {
    start: cmd.start.enabled,
    help: cmd.help.enabled,
    reset: cmd.reset.enabled,
    clear: cmd.clear.enabled,
    info: cmd.info.enabled,
    git: cmd.git.enabled,
    model: cmd.model.enabled,
    engine: cmd.engine.enabled,
    npm: cmd.npm.enabled,
  };

  // Build per-command visibility map from resolved config
  const visibility: CommandVisibility = {
    start: {
      showInMenu: cmd.start.showInMenu,
      showInHelp: cmd.start.showInHelp,
    },
    help: { showInMenu: cmd.help.showInMenu, showInHelp: cmd.help.showInHelp },
    reset: {
      showInMenu: cmd.reset.showInMenu,
      showInHelp: cmd.reset.showInHelp,
    },
    clear: {
      showInMenu: cmd.clear.showInMenu,
      showInHelp: cmd.clear.showInHelp,
    },
    info: { showInMenu: cmd.info.showInMenu, showInHelp: cmd.info.showInHelp },
    git_init: {
      showInMenu: cmd.git.showInMenu,
      showInHelp: cmd.git.showInHelp,
    },
    git_status: {
      showInMenu: cmd.git.showInMenu,
      showInHelp: cmd.git.showInHelp,
    },
    git_commit: {
      showInMenu: cmd.git.showInMenu,
      showInHelp: cmd.git.showInHelp,
    },
    git_clean: {
      showInMenu: cmd.git.showInMenu,
      showInHelp: cmd.git.showInHelp,
    },
    model: {
      showInMenu: cmd.model.showInMenu,
      showInHelp: cmd.model.showInHelp,
    },
    engine: {
      showInMenu: cmd.engine.showInMenu,
      showInHelp: cmd.engine.showInHelp,
    },
  };

  // Register project-specific commands and skills with Telegram on startup
  const skillsDirs = engine.skillsDirs(config.cwd);
  const commands = await loadCommands(
    config.cwd,
    config.configDir,
    logger,
    skillsDirs,
    enabledFlags,
    cmd.npm.enabled
      ? {
          whitelist: cmd.npm.whitelist,
          blacklist: cmd.npm.blacklist,
          showInMenu: cmd.npm.showInMenu,
          showInHelp: cmd.npm.showInHelp,
        }
      : undefined,
  );
  const commandsForMenu = commandsForTelegramMenu(commands, visibility);
  if (commandsForMenu.length > 0) {
    const tooLong = getCommandsWithDescriptionTooLong(
      commandsForMenu,
      config.configDir,
    );
    if (tooLong.length > 0) {
      const details = tooLong
        .map(
          (o) =>
            `  /${o.command}: description length ${o.length} (max 256) — ${o.path}`,
        )
        .join("\n");
      throw new Error(
        `Command description(s) exceed Telegram's 256-character limit:\n${details}`,
      );
    }
    await bot.api.setMyCommands(
      commandsForMenu.map((c) => ({
        command: c.command,
        description: c.description,
      })),
    );
    logger.info(
      { count: commandsForMenu.length },
      "Commands registered with Telegram",
    );
  }

  // Start file watcher for hot-reload of command and skill files
  const watcher = startCommandWatcher(
    bot,
    config.cwd,
    config.configDir,
    logger,
    skillsDirs,
    enabledFlags,
    visibility,
    cmd.npm.enabled
      ? {
          whitelist: cmd.npm.whitelist,
          blacklist: cmd.npm.blacklist,
          showInMenu: cmd.npm.showInMenu,
          showInHelp: cmd.npm.showInHelp,
        }
      : undefined,
  );

  return {
    bot,
    stop: async () => {
      await watcher.stop();
      clearAllPrompts();
      rateLimitCleanup();
      await bot.stop(); // Stops polling; Grammy waits for in-flight updates to finish
      await runningPromise;
    },
  };
}
