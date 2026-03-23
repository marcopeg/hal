import { join, resolve } from "node:path";
import type { Context } from "grammy";
import { createAgent, getSkillsDirs } from "../../agent/index.js";
import { resolveContext } from "../../context/resolver.js";
import { getDefaultEngineModel } from "../../default-models.js";
import { sendChunkedResponse } from "../../telegram/chunker.js";
import { sendDownloadFiles } from "../../telegram/fileSender.js";
import type { ProjectContext } from "../../types.js";
import {
  clearSessionData,
  ensureUserSetup,
  getDownloadsPath,
  getSessionId,
  saveSessionId,
} from "../../user/setup.js";
import { resolveCommandPath, resolveSkillEntry } from "../commands/loader.js";
import { executeNpmScript } from "../commands/npm/index.js";
import {
  NpmScriptError,
  readPackageScripts,
  resolveAllowedScripts,
} from "../commands/npm/scripts.js";
import { normalizeCustomCommandResult } from "../commands/result.js";
import {
  shouldLoadSessionFromUserDir,
  shouldPersistUserSessionToUserDir,
} from "./session.js";

export interface BufferedTextPart {
  text: string;
  messageId: number;
}

export interface BufferedTextResolution {
  mode: "fragment" | "burst" | "hybrid";
  text: string;
}

function isHighConfidenceBurstBoundary(
  previousText: string,
  nextText: string,
): boolean {
  const previousTrimmed = previousText.trimEnd();
  const nextTrimmed = nextText.trimStart();

  if (!previousTrimmed || !nextTrimmed) {
    return false;
  }

  const previousLooksComplete =
    previousTrimmed.endsWith("\n") || /[.!?…]["')\]]*$/.test(previousTrimmed);
  if (!previousLooksComplete) {
    return false;
  }

  return /^(?:[A-Z]|["'([]|[-*]\s|\d+[.)\]]\s)/.test(nextTrimmed);
}

function shouldUseLeadInBoundary(
  previousText: string,
  nextText: string,
): boolean {
  const previousTrimmed = previousText.trimEnd();
  const nextTrimmed = nextText.trimStart();

  if (!previousTrimmed || !nextTrimmed) {
    return false;
  }

  return (
    previousTrimmed.length <= 120 &&
    /[:.!?]$/.test(previousTrimmed) &&
    nextTrimmed.length >= 1000
  );
}

function shouldInsertSoftSpace(
  previousPart: BufferedTextPart,
  nextPart: BufferedTextPart,
): boolean {
  const previousText = previousPart.text;
  const nextText = nextPart.text;
  if (!previousText || !nextText) {
    return false;
  }

  const previousChar = previousText.at(-1) ?? "";
  const nextChar = nextText[0] ?? "";

  if (/\s/.test(previousChar) || /\s/.test(nextChar)) {
    return false;
  }

  if (!/[A-Za-z0-9]$/.test(previousChar) || !/^[A-Za-z0-9]/.test(nextChar)) {
    return false;
  }

  return previousPart.text.length >= 3500 || nextPart.text.length >= 3500;
}

function getBoundarySeparator(
  previousPart: BufferedTextPart,
  nextPart: BufferedTextPart,
): "" | " " | "\n" {
  if (shouldUseLeadInBoundary(previousPart.text, nextPart.text)) {
    return "\n";
  }

  if (isHighConfidenceBurstBoundary(previousPart.text, nextPart.text)) {
    return "\n";
  }

  if (shouldInsertSoftSpace(previousPart, nextPart)) {
    return " ";
  }

  return "";
}

export function classifyBufferedTextParts(
  parts: BufferedTextPart[],
): BufferedTextResolution {
  const sortedParts = [...parts].sort((a, b) => a.messageId - b.messageId);

  if (sortedParts.length <= 1) {
    return {
      mode: "fragment",
      text: sortedParts.map((part) => part.text).join(""),
    };
  }

  const separators = sortedParts
    .slice(1)
    .map((part, index) => getBoundarySeparator(sortedParts[index], part));

  const uniqueSeparators = new Set(separators);
  const mode: BufferedTextResolution["mode"] =
    uniqueSeparators.size === 1 && uniqueSeparators.has("\n")
      ? "burst"
      : uniqueSeparators.size === 1 && uniqueSeparators.has("")
        ? "fragment"
        : "hybrid";

  let text = sortedParts[0]?.text ?? "";
  for (let index = 1; index < sortedParts.length; index += 1) {
    text += separators[index - 1] + sortedParts[index].text;
  }

  return {
    mode,
    text,
  };
}

/**
 * Returns a handler for text messages.
 */
export function createTextHandler(
  ctx: ProjectContext,
  debounceActiveUsers: Set<number>,
) {
  const { config, logger } = ctx;
  const windowMs = config.telegram.message.debounceMs;

  interface BufferEntry {
    parts: BufferedTextPart[];
    timer: ReturnType<typeof setTimeout>;
    gramCtx: Context;
    statusMsgId?: number;
    lastActivityAt: number;
  }
  const buffers = new Map<number, BufferEntry>();

  function scheduleFlush(
    userId: number,
    delayMs = windowMs,
  ): ReturnType<typeof setTimeout> {
    return setTimeout(() => flush(userId), delayMs);
  }

  async function dispatchToEngine(
    gramCtx: Context,
    text: string,
    existingStatusMsgId?: number,
  ): Promise<void> {
    const userId = gramCtx.from?.id;
    if (!userId) return;

    const userDir = resolve(join(config.dataDir, String(userId)));

    await ensureUserSetup(userDir);

    if (!text.trim()) {
      await gramCtx.reply("Please provide a message.");
      return;
    }

    const shouldLoadSession = shouldLoadSessionFromUserDir(
      config.engineSession,
      ctx.engine,
    );
    const sessionId = shouldLoadSession ? await getSessionId(userDir) : null;
    logger.debug({ sessionId: sessionId || "new" }, "Session");

    let statusMsgId: number;
    if (existingStatusMsgId !== undefined) {
      statusMsgId = existingStatusMsgId;
      try {
        await gramCtx.api.editMessageText(
          gramCtx.chat!.id,
          statusMsgId,
          "_Processing..._",
          { parse_mode: "Markdown" },
        );
      } catch {
        // Ignore edit errors
      }
    } else {
      const statusMsg = await gramCtx.reply("_Processing..._", {
        parse_mode: "Markdown",
      });
      statusMsgId = statusMsg.message_id;
    }

    let lastProgressUpdate = Date.now();
    let lastProgressText = "Processing...";

    const onProgress = async (message: string) => {
      const now = Date.now();
      if (now - lastProgressUpdate > 2000 && message !== lastProgressText) {
        lastProgressUpdate = now;
        lastProgressText = message;
        try {
          await gramCtx.api.editMessageText(
            gramCtx.chat!.id,
            statusMsgId,
            `_${message}_`,
            { parse_mode: "Markdown" },
          );
        } catch {
          // Ignore edit errors
        }
      }
    };

    const downloadsPath = getDownloadsPath(userDir);

    logger.info("Executing engine query");
    const result = await ctx.engine.execute(
      {
        prompt: text,
        gramCtx,
        userDir,
        downloadsPath,
        sessionId,
        onProgress,
      },
      ctx,
    );
    logger.info(
      {
        success: result.success,
        error: result.error,
        response: result.output?.slice(0, 200),
      },
      "Engine result",
    );

    try {
      await gramCtx.api.deleteMessage(gramCtx.chat!.id, statusMsgId);
    } catch {
      // Ignore delete errors
    }

    const parsed = ctx.engine.parse(result);
    if (config.engineSession !== false && parsed.sessionId) {
      await saveSessionId(userDir, parsed.sessionId);
      logger.debug({ sessionId: parsed.sessionId }, "Session saved");
    } else if (
      shouldPersistUserSessionToUserDir(config.engineSession, ctx.engine)
    ) {
      await clearSessionData(userDir);
    }

    if (parsed.warning) {
      await gramCtx.reply(parsed.warning);
    }

    await sendChunkedResponse(gramCtx, parsed.text);

    const filesSent = await sendDownloadFiles(gramCtx, userDir, ctx);
    if (filesSent > 0) {
      logger.info({ filesSent }, "Sent download files to user");
    }
  }

  function flush(userId: number): void {
    const buf = buffers.get(userId);
    if (!buf) return;

    const remainingMs = buf.lastActivityAt + windowMs - Date.now();
    if (remainingMs > 0) {
      clearTimeout(buf.timer);
      buf.timer = scheduleFlush(userId, remainingMs);
      return;
    }

    buffers.delete(userId);
    debounceActiveUsers.delete(userId);
    const resolved = classifyBufferedTextParts(buf.parts);
    logger.debug(
      { userId, parts: buf.parts.length, mode: resolved.mode },
      "Flushing buffered text",
    );
    dispatchToEngine(buf.gramCtx, resolved.text, buf.statusMsgId).catch(
      (err) => {
        logger.error({ err }, "Debounce flush error");
      },
    );
  }

  return async (gramCtx: Context): Promise<void> => {
    const userId = gramCtx.from?.id;
    const messageText = gramCtx.message?.text;
    const messageId = gramCtx.message?.message_id;

    if (!userId || !messageText) {
      return;
    }

    logger.info(
      {
        userId,
        username: gramCtx.from?.username,
        name: gramCtx.from?.first_name,
        message: messageText,
      },
      "Message received",
    );

    // ── Slash command interception ────────────────────────────────────────────
    if (messageText.startsWith("/")) {
      // Parse command name: /deploy staging → "deploy", strip @botname suffix
      const firstToken = messageText.slice(1).split(/\s+/)[0] ?? "";
      const commandName = firstToken.split("@")[0];
      const argsText = messageText.slice(1 + firstToken.length).trim();
      const args = argsText ? argsText.split(/\s+/) : [];

      if (commandName) {
        logger.info(
          {
            commandName,
            args,
            hasArgs: args.length > 0,
          },
          "Slash command received",
        );
        let filePath: string | null;
        try {
          filePath = await resolveCommandPath(
            commandName,
            config.cwd,
            config.configDir,
          );
        } catch (err) {
          logger.error(
            {
              commandName,
              error: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
            "Failed to resolve custom command metadata",
          );
          const errorMessage = err instanceof Error ? err.message : String(err);
          await gramCtx.reply(`Command failed: ${errorMessage}`);
          return;
        }

        if (filePath !== null) {
          try {
            logger.info(
              {
                commandName,
                filePath,
                source: filePath.startsWith(resolve(config.cwd))
                  ? "project"
                  : "system",
              },
              "Slash command matched custom .mjs command",
            );
            const context = await resolveContext({
              gramCtx,
              configContext: config.context,
              bootContext: ctx.bootContext,
              configDir: config.configDir,
              projectCwd: config.cwd,
              projectName: config.name,
              projectSlug: config.slug,
              logger,
              engineName: config.engine,
              engineCommand: ctx.engine.command,
              engineModel: config.engineModel,
              engineDefaultModel: config.engineModel
                ? undefined
                : (getDefaultEngineModel(config.engine) ?? "engine-defaults"),
            });
            const agent = createAgent(ctx);
            // Cache-bust on every dispatch call
            const mod = await import(`${filePath}?t=${Date.now()}`);
            logger.info(
              {
                commandName,
                filePath,
              },
              "Executing custom .mjs command",
            );
            const rawResult = await mod.default({
              args,
              ctx: context,
              gram: gramCtx,
              agent,
              projectCtx: ctx,
            });
            const result = normalizeCustomCommandResult(rawResult, logger, {
              commandName,
              filePath,
            });

            if (result.type === "assistant") {
              logger.info(
                {
                  commandName,
                  filePath,
                  resultType: result.type,
                },
                "Custom .mjs command handled the message directly",
              );
              await sendChunkedResponse(gramCtx, result.message);
            } else if (result.type === "agent") {
              logger.info(
                {
                  commandName,
                  filePath,
                  resultType: result.type,
                  replacedPrompt: result.message !== undefined,
                },
                "Custom .mjs command yielded to the agent",
              );
              await dispatchToEngine(gramCtx, result.message ?? messageText);
            } else {
              logger.info(
                {
                  commandName,
                  filePath,
                  resultType: result.type,
                },
                "Custom .mjs command handled the message without agent handoff",
              );
            }
          } catch (err) {
            logger.error(
              {
                commandName,
                filePath,
                error: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined,
              },
              "Command execution failed",
            );
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            await gramCtx.reply(`Command failed: ${errorMessage}`);
          }
          return;
        }

        // No .mjs handler — check if this is a registered skill
        const skillEntry = await resolveSkillEntry(
          commandName,
          getSkillsDirs(config.cwd, ctx),
          logger,
        );

        if (skillEntry?.skillPrompt && skillEntry.enabled) {
          logger.info(
            {
              commandName,
              skillPath: skillEntry.filePath,
            },
            "Slash command matched telegram skill",
          );
          const prompt =
            args.length > 0
              ? `${skillEntry.skillPrompt}\n\nUser input: ${args.join(" ")}`
              : skillEntry.skillPrompt;

          const agent = createAgent(ctx);
          const statusMsg = await gramCtx.reply("_Processing..._", {
            parse_mode: "Markdown",
          });
          let lastProgressUpdate = Date.now();

          try {
            logger.info(
              {
                commandName,
                skillPath: skillEntry.filePath,
                yieldedToAgent: true,
              },
              "Executing skill through agent",
            );
            const result = await agent.call(prompt, {
              onProgress: async (message: string) => {
                const now = Date.now();
                if (now - lastProgressUpdate > 2000) {
                  lastProgressUpdate = now;
                  try {
                    await gramCtx.api.editMessageText(
                      gramCtx.chat!.id,
                      statusMsg.message_id,
                      `_${message}_`,
                      { parse_mode: "Markdown" },
                    );
                  } catch {
                    // Ignore edit errors
                  }
                }
              },
            });
            logger.info(
              {
                commandName,
                skillPath: skillEntry.filePath,
              },
              "Skill handled the slash command",
            );
            await gramCtx.api.deleteMessage(
              gramCtx.chat!.id,
              statusMsg.message_id,
            );
            await sendChunkedResponse(gramCtx, result);
          } catch (err) {
            logger.error(
              {
                commandName,
                error: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined,
              },
              "Skill execution failed",
            );
            try {
              await gramCtx.api.deleteMessage(
                gramCtx.chat!.id,
                statusMsg.message_id,
              );
            } catch {
              // Ignore delete errors
            }
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            await gramCtx.reply(`Skill failed: ${errorMessage}`);
          }
          return;
        }

        // Check npm-derived script commands before falling through to the agent.
        // Individual npm script entries (sanitized script names) are registered in
        // the Telegram menu when npm is enabled; clicking them sends the command
        // name directly and reaches here instead of the /npm Grammy handler.
        if (config.commands.npm.enabled) {
          const npmCfg = config.commands.npm;
          try {
            const scripts = readPackageScripts(config.cwd);
            const allowed = resolveAllowedScripts(
              Object.keys(scripts),
              npmCfg.whitelist,
              npmCfg.blacklist,
            );
            // Match the sanitized command name back to a script name.
            const matchedScript = allowed.find((script) => {
              if (script === commandName) return true;
              const sanitized = script
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, "_")
                .replace(/_+/g, "_")
                .replace(/^_|_$/g, "")
                .slice(0, 32);
              return sanitized === commandName;
            });
            if (matchedScript) {
              logger.info(
                {
                  commandName,
                  script: matchedScript,
                },
                "Slash command matched npm script",
              );
              await executeNpmScript(ctx, gramCtx, matchedScript);
              return;
            }
          } catch (err) {
            if (!(err instanceof NpmScriptError)) {
              logger.warn(
                {
                  commandName,
                  error: err instanceof Error ? err.message : String(err),
                },
                "npm script lookup failed",
              );
            }
            // NpmScriptError (missing/empty package.json) → fall through
          }
        }

        // Not a .mjs command, skill, or npm script — fall through to Claude
        logger.info(
          {
            commandName,
          },
          "Slash command did not match a custom handler; forwarding to agent",
        );
      }
    }
    // ── End slash command interception ────────────────────────────────────────

    if (messageText.startsWith("/")) {
      try {
        await dispatchToEngine(gramCtx, messageText);
      } catch (error) {
        logger.error({ error }, "Text handler error");
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        await gramCtx.reply(`An error occurred: ${errorMessage}`);
      }
      return;
    }

    const existing = buffers.get(userId);

    try {
      if (!existing) {
        const now = Date.now();
        debounceActiveUsers.add(userId);
        const buffer: BufferEntry = {
          parts: [{ text: messageText, messageId: messageId ?? 0 }],
          timer: scheduleFlush(userId),
          gramCtx,
          lastActivityAt: now,
        };
        buffers.set(userId, buffer);
      } else {
        const now = Date.now();
        clearTimeout(existing.timer);
        existing.parts.push({ text: messageText, messageId: messageId ?? 0 });
        existing.gramCtx = gramCtx;
        existing.lastActivityAt = now;
        existing.timer = scheduleFlush(userId);
      }
    } catch (error) {
      logger.error({ error }, "Text handler error");
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await gramCtx.reply(`An error occurred: ${errorMessage}`);
    }
  };
}
