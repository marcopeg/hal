import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { updateProjectEngine } from "../../config-writer.js";
import type { EngineName } from "../../engine/types.js";
import type { ProjectContext } from "../../types.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function createEngineHandler(
  projectCtx: ProjectContext,
): (ctx: Context) => Promise<void> {
  return async (gramCtx: Context) => {
    const { config, logger } = projectCtx;
    const engines = config.availableEngines;
    const currentEngine = config.engine;
    const currentModel = config.engineModel;

    const messageText = gramCtx.message?.text ?? "";
    const directMatch = messageText.match(/^\/engine(?:@\w+)?\s+(.+)$/i);
    const directEngine = directMatch?.[1]?.trim();

    if (directEngine) {
      const valid = engines.some((e) => e === directEngine);
      if (!valid) {
        const available = engines
          .map((e) => `• <code>${escapeHtml(e)}</code>`)
          .join("\n");
        await gramCtx.reply(
          `Engine <b>${escapeHtml(directEngine)}</b> is not in the configured engines list.\n\nAvailable engines:\n${available}`,
          { parse_mode: "HTML" },
        );
        return;
      }

      try {
        updateProjectEngine(
          config.configDir,
          config.slug,
          directEngine as EngineName,
        );
        logger.info(
          { engine: directEngine },
          "Engine switched via direct /engine argument",
        );
      } catch (err) {
        logger.error(
          { error: err instanceof Error ? err.message : String(err) },
          "Failed to write engine config",
        );
        await gramCtx.reply("Failed to update engine in config.");
        return;
      }

      await gramCtx.reply(
        `✅ Engine set to <b>${escapeHtml(directEngine)}</b>\n\nModel selection has been cleared. The change will take effect shortly.`,
        { parse_mode: "HTML" },
      );
      return;
    }

    const lines: string[] = [];
    lines.push("<b>Switch Engine</b>");
    lines.push(`Current: <b>${escapeHtml(currentEngine)}</b>`);
    if (currentModel) {
      lines.push(`Model: <b>${escapeHtml(currentModel)}</b>`);
    }
    lines.push("");

    for (const engine of engines) {
      const isCurrent = engine === currentEngine;
      const marker = isCurrent ? "▸ " : "   ";
      lines.push(`${marker}<b>${escapeHtml(engine)}</b>`);
    }

    lines.push("");
    lines.push(
      "<i>Tip: use /engine &lt;name&gt; to set an engine directly.</i>",
    );

    const keyboard = new InlineKeyboard();
    for (const engine of engines) {
      const isCurrent = engine === currentEngine;
      const label = isCurrent ? `✓ ${engine}` : engine;
      keyboard.text(label, `en:select:${engine}`).row();
    }

    await gramCtx.reply(lines.join("\n"), {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  };
}
