import type { Context } from "grammy";
import { resolveContext } from "../../context/resolver.js";
import { getDefaultEngineModel } from "../../default-models.js";
import type { ProjectContext } from "../../types.js";

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
const CONTEXT_CHUNK_LIMIT = 3500;

function inlineCode(value: string): string {
  // Avoid breaking markdown code spans.
  return `\`${value.replace(/`/g, "'")}\``;
}

function normalizeContextValue(value: string): string {
  return value.replace(/\r\n/g, "\\n").replace(/\n/g, "\\n");
}

function sanitizeForCodeFence(value: string): string {
  return value.replace(/```/g, "'''");
}

function splitContextLines(lines: string[], maxChunkLength: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const rawLine of lines) {
    const line = rawLine.length > 0 ? rawLine : " ";
    if (line.length > maxChunkLength) {
      if (current.length > 0) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < line.length; i += maxChunkLength) {
        chunks.push(line.slice(i, i + maxChunkLength));
      }
      continue;
    }

    const candidate = current.length > 0 ? `${current}\n${line}` : line;
    if (candidate.length > maxChunkLength) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : ["(empty)"];
}

function buildContextMessages(lines: string[]): string[] {
  const chunks = splitContextLines(lines, CONTEXT_CHUNK_LIMIT);
  return chunks.map((chunk, index) => {
    const header =
      chunks.length === 1
        ? "*Context:*"
        : `*Context (part ${index + 1}/${chunks.length}):*`;

    const message = `${header}\n\`\`\`\n${chunk}\n\`\`\``;
    if (message.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
      return message;
    }

    // Keep valid output in pathological cases.
    const trimmedChunk = chunk.slice(0, CONTEXT_CHUNK_LIMIT - 64);
    return `${header}\n\`\`\`\n${trimmedChunk}\n...\n\`\`\``;
  });
}

function getCurrentModel(ctx: ProjectContext): string {
  return (
    ctx.config.engineModel ??
    ctx.config.providerDefaultModel ??
    getDefaultEngineModel(ctx.config.engine) ??
    "engine-default"
  );
}

export function createInfoHandler(projectCtx: ProjectContext) {
  return async (gramCtx: Context): Promise<void> => {
    const { config, logger, bootContext, engine } = projectCtx;
    const infoCfg = config.commands.info;

    const summaryLines: string[] = [
      `*Project:* ${inlineCode(config.name ?? config.slug)}`,
    ];

    if (infoCfg.cwd) {
      summaryLines.push(`*CWD:* ${inlineCode(config.cwd)}`);
    }

    if (infoCfg.engineModel) {
      summaryLines.push(`*Engine:* ${inlineCode(config.engine)}`);
      summaryLines.push(`*Model:* ${inlineCode(getCurrentModel(projectCtx))}`);
    }

    if (infoCfg.session) {
      summaryLines.push(
        `*Session:* ${inlineCode(String(config.engineSession))}`,
      );
    }

    await gramCtx.reply(summaryLines.join("\n"), { parse_mode: "Markdown" });

    if (!infoCfg.context) {
      return;
    }

    const resolvedContext = await resolveContext({
      gramCtx,
      configContext: config.context,
      bootContext,
      configDir: config.configDir,
      projectCwd: config.cwd,
      projectName: config.name,
      projectSlug: config.slug,
      logger,
      engineName: config.engine,
      engineCommand: engine.command,
      engineModel: config.engineModel,
      engineDefaultModel: config.engineModel
        ? undefined
        : (getDefaultEngineModel(config.engine) ?? "engine-defaults"),
    });

    const contextLines = Object.entries(resolvedContext)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) =>
        sanitizeForCodeFence(`${key}: ${normalizeContextValue(value)}`),
      );

    const messages = buildContextMessages(contextLines);
    for (const message of messages) {
      await gramCtx.reply(message, { parse_mode: "Markdown" });
    }
  };
}
