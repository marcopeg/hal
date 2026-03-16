import type { Context, NextFunction } from "grammy";
import type { ProjectContext } from "../../types.js";
import {
  buildTranscriptDiscardedText,
  buildTranscriptFinalText,
  clearPending,
  getPending,
} from "./voice-pending.js";

function parseVoiceCallbackData(data: string): {
  action: "use" | "cancel";
  ownerUserId: number;
} | null {
  const parts = data.split(":");
  if (parts.length !== 3 || parts[0] !== "tc") {
    return null;
  }

  const action = parts[1];
  if (action !== "use" && action !== "cancel") {
    return null;
  }

  const ownerUserId = Number(parts[2]);
  if (!Number.isInteger(ownerUserId)) {
    return null;
  }

  return { action, ownerUserId };
}

async function safeAnswerCallbackQuery(
  ctx: Context,
  text?: string,
): Promise<void> {
  try {
    if (text) {
      await ctx.answerCallbackQuery({ text });
    } else {
      await ctx.answerCallbackQuery();
    }
  } catch {
    // Ignore answer callback query failures.
  }
}

export function createVoiceCallbackHandler(projectCtx: ProjectContext) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    const data = ctx.callbackQuery?.data;
    if (!data?.startsWith("tc:")) {
      return next();
    }

    const parsed = parseVoiceCallbackData(data);
    if (!parsed) {
      await safeAnswerCallbackQuery(ctx, "Invalid confirmation data");
      return;
    }

    const callerUserId = ctx.from?.id;
    if (!callerUserId || callerUserId !== parsed.ownerUserId) {
      await safeAnswerCallbackQuery(
        ctx,
        "This confirmation belongs to another user",
      );
      return;
    }

    const pending = getPending(parsed.ownerUserId);
    if (!pending) {
      await safeAnswerCallbackQuery(
        ctx,
        parsed.action === "use" ? "Confirmation expired" : "Already handled",
      );
      return;
    }

    await safeAnswerCallbackQuery(ctx);
    clearPending(parsed.ownerUserId);

    if (parsed.action === "cancel") {
      try {
        await ctx.api.editMessageText(
          pending.chatId,
          pending.msgId,
          buildTranscriptDiscardedText(pending.transcript),
          { reply_markup: undefined },
        );
      } catch {
        // Ignore races against expiry edits.
      }

      try {
        await ctx.api.editMessageReplyMarkup(pending.chatId, pending.msgId, {
          reply_markup: undefined,
        });
      } catch {
        // Ignore races against expiry edits.
      }
      return;
    }

    try {
      await ctx.api.editMessageText(
        pending.chatId,
        pending.msgId,
        buildTranscriptFinalText(pending.transcript),
        { reply_markup: undefined },
      );
    } catch {
      // Ignore races against expiry edits.
    }

    try {
      await ctx.api.editMessageReplyMarkup(pending.chatId, pending.msgId, {
        reply_markup: undefined,
      });
    } catch {
      // Ignore races against expiry edits.
    }

    try {
      await pending.execute();
    } catch (error) {
      projectCtx.logger.error(
        { error, userId: parsed.ownerUserId },
        "Voice confirmation execution failed",
      );
      await ctx.reply(
        "Failed to process confirmed transcript. Please try again.",
      );
    }
  };
}
