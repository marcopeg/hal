import type { Context, NextFunction } from "grammy";
import { updateProjectEngine } from "../../config-writer.js";
import type { EngineName } from "../../engine/types.js";
import type { ProjectContext } from "../../types.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function createEngineCallbackHandler(
  projectCtx: ProjectContext,
): (ctx: Context, next: NextFunction) => Promise<void> {
  return async (gramCtx: Context, next: NextFunction) => {
    const data = gramCtx.callbackQuery?.data;
    if (!data?.startsWith("en:")) {
      return next();
    }

    const { config, logger } = projectCtx;

    const parts = data.split(":");
    if (parts[1] !== "select" || !parts[2]) {
      await gramCtx.answerCallbackQuery("Invalid selection");
      return;
    }
    const engineId = parts.slice(2).join(":") as EngineName;

    const engines = config.availableEngines;
    if (!engines.includes(engineId)) {
      await gramCtx.answerCallbackQuery("Engine no longer available");
      return;
    }

    try {
      updateProjectEngine(config.configDir, config.slug, engineId);
      logger.info({ engine: engineId }, "Engine switched");
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Failed to write engine config",
      );
      await gramCtx.answerCallbackQuery("Failed to update config");
      return;
    }

    await gramCtx.answerCallbackQuery(`Engine switched to ${engineId}`);
    await gramCtx.editMessageText(
      `✅ Engine switched to <b>${escapeHtml(engineId)}</b>\n\nModel selection has been cleared. The change will take effect shortly.`,
      { parse_mode: "HTML" },
    );
  };
}
