import type pino from "pino";
import { createAgent } from "../agent/index.js";
import {
  buildCronContextVars,
  formatContextPrompt,
} from "../context/resolver.js";
import { getDefaultEngineModel } from "../default-models.js";
import type { ProjectContext } from "../types.js";
import { writeCronLog } from "./log.js";
import type { CronContext, MdCronDefinition } from "./types.js";

/**
 * Execute a .md cron definition.
 *
 * For each target: calls the project engine anonymously with the prompt body,
 * then optionally sends the result to a Telegram user if flowResult: true.
 *
 * Context (sys.*, project.*, engine.*, bot.userId) is injected into the prompt
 * the same way as user-driven messages. bot.messageId and bot.chatId are empty
 * since there is no inbound Telegram message. userDir / session scoping is
 * deferred to 032b.
 *
 * @param internalProjectCtxs - full ProjectContext per project slug; not exposed in CronContext
 * @param logBaseDir - base directory for execution logs (configDir for system tier)
 */
export async function executeMdCron(
  def: MdCronDefinition,
  internalProjectCtxs: Record<string, ProjectContext>,
  cronCtx: CronContext,
  logBaseDir: string,
  logger: pino.Logger,
): Promise<void> {
  for (const target of def.targets) {
    const projectCtx = internalProjectCtxs[target.projectId];
    if (!projectCtx) {
      logger.error(
        { jobName: def.name, projectId: target.projectId },
        "Cron target projectId not found — skipping target",
      );
      continue;
    }

    const startedAt = new Date();
    let output = "";
    let error: string | undefined;

    try {
      const { config, logger: pLogger, bootContext } = projectCtx;
      const defaultModel = config.engineModel
        ? undefined
        : (getDefaultEngineModel(config.engine) ?? "engine-defaults");
      const contextVars = await buildCronContextVars({
        configContext: config.context,
        bootContext,
        configDir: config.configDir,
        projectCwd: config.cwd,
        projectName: config.name,
        projectSlug: config.slug,
        logger: pLogger,
        engineName: config.engine,
        engineCommand: projectCtx.engine.command,
        engineModel: config.engineModel,
        engineDefaultModel: defaultModel,
        userId: target.userId,
      });
      const contextualPrompt = formatContextPrompt(contextVars, def.prompt);

      const agent = createAgent(projectCtx);
      output = await agent.call(contextualPrompt);

      if (target.flowResult && target.userId) {
        const projectCronCtx = cronCtx.projects[target.projectId];
        await projectCronCtx.bot.api.sendMessage(target.userId, output);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      logger.error(
        { jobName: def.name, projectId: target.projectId, error },
        "Cron .md execution failed",
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
}
