import type pino from "pino";
import { writeCronLog } from "./log.js";
import type { CronContext, MjsCronDefinition } from "./types.js";

/**
 * Execute a .mjs cron definition.
 * Calls the exported handler with the full CronContext.
 * Any error thrown by the handler is caught, logged, and recorded in the execution log.
 */
export async function executeMjsCron(
  def: MjsCronDefinition,
  ctx: CronContext,
  logBaseDir: string,
  logger: pino.Logger,
): Promise<void> {
  const startedAt = new Date();
  let output = "";
  let error: string | undefined;

  try {
    await def.handler(ctx);
    output = "(programmatic handler completed)";
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    logger.error(
      { jobName: def.name, error },
      "Cron .mjs handler threw an error",
    );
  }

  writeCronLog(logBaseDir, {
    jobName: def.name,
    sourceFile: def.sourceFile,
    startedAt,
    finishedAt: new Date(),
    output,
    error,
  });
}
