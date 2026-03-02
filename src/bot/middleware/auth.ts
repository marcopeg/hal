import type { Context, NextFunction } from "grammy";
import type { ProjectContext } from "../../types.js";

const DENIED_MSG =
  "Sorry, you are not authorized to use this bot.\n" +
  "Contact the administrator to request access.";

export function createAuthMiddleware(ctx: ProjectContext) {
  return async (gramCtx: Context, next: NextFunction): Promise<void> => {
    const { allowedUserIds, dangerouslyAllowUnrestrictedAccess } =
      ctx.config.access;
    const userId = gramCtx.from?.id;

    // allowedUserIds takes precedence over dangerouslyAllowUnrestrictedAccess
    if (allowedUserIds.length > 0) {
      if (userId && allowedUserIds.includes(userId)) {
        await next();
        return;
      }
      await gramCtx.reply(DENIED_MSG);
      return;
    }

    if (dangerouslyAllowUnrestrictedAccess) {
      await next();
      return;
    }

    // Defensive: boot validation should prevent reaching this branch
    await gramCtx.reply(DENIED_MSG);
  };
}
