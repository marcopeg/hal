import { execSync } from "node:child_process";
import { join } from "node:path";
import type { ProjectContext } from "../../types.js";
import { buildContextualPrompt } from "../prompt.js";
import { spawnEngineProcess } from "../spawn.js";
import type {
  EngineAdapter,
  EngineExecuteOptions,
  EngineResult,
  ParsedResponse,
} from "../types.js";

const DEFAULT_COMMAND = "claude";
const CLAUDE_STALE_SESSION_WARNING =
  "Warning: HAL could not resume your previous Claude session, so this reply was processed in a fresh session. Session continuity was reset for future messages.";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ClaudeContinuationMode = "resume" | "continue" | "none";

interface ClaudeRunResult {
  result: EngineResult;
  stderr: string;
  continuationMode: ClaudeContinuationMode;
}

function isBlankAssistantOutput(result: EngineResult): boolean {
  return result.output.trim().length === 0;
}

function isClaudeContinuationRecoveryError(
  result: EngineResult,
  stderr: string,
): boolean {
  if (result.success) {
    return false;
  }

  const text =
    `${result.error ?? ""}\n${result.output}\n${stderr}`.toLowerCase();
  const referencesContinuation =
    text.includes("resume") ||
    text.includes("continue") ||
    text.includes("session") ||
    text.includes("conversation");
  const indicatesMissingState =
    text.includes("not found") ||
    text.includes("no such") ||
    text.includes("invalid") ||
    text.includes("unknown") ||
    text.includes("expired") ||
    text.includes("does not exist") ||
    text.includes("unable to") ||
    text.includes("cannot") ||
    text.includes("can't");

  return referencesContinuation && indicatesMissingState;
}

function shouldRetryClaudeContinuation(run: ClaudeRunResult): boolean {
  if (run.continuationMode === "none") {
    return false;
  }

  if (run.result.success) {
    return isBlankAssistantOutput(run.result);
  }

  return isClaudeContinuationRecoveryError(run.result, run.stderr);
}

function isValidClaudeSessionId(sessionId: string): boolean {
  return UUID_RE.test(sessionId);
}

export function createClaudeAdapter(
  command?: string,
  model?: string,
): EngineAdapter {
  const cmd = command || DEFAULT_COMMAND;

  return {
    name: "Claude Code",
    command: cmd,
    sessionCapabilities: {
      supportsUserIsolation: true,
      defaultMode: "user",
      sharedContinuationRequiresMarker: false,
    },

    check() {
      try {
        execSync(`${cmd} --version`, { stdio: "pipe" });
      } catch {
        throw new Error(
          `Claude CLI command "${cmd}" not found or not executable. ` +
            `Please ensure Claude Code is installed and the command is in your PATH.`,
        );
      }
    },

    async execute(
      options: EngineExecuteOptions,
      ctx: ProjectContext,
    ): Promise<EngineResult> {
      const { sessionId, onProgress, continueSession } = options;
      const { config, logger } = ctx;

      const fullPrompt = await buildContextualPrompt(options, ctx);
      const cwd = config.cwd;
      const usesUserResume =
        config.engineSession !== false &&
        config.engineSession !== "shared" &&
        continueSession !== false &&
        typeof sessionId === "string";

      const buildArgs = (
        useContinuation: boolean,
      ): { args: string[]; continuationMode: ClaudeContinuationMode } => {
        const args: string[] = [
          "-p",
          fullPrompt,
          "--output-format",
          "stream-json",
          "--verbose",
        ];

        if (model) {
          args.push("--model", model);
        }

        if (
          useContinuation &&
          config.engineSession !== false &&
          continueSession !== false
        ) {
          if (config.engineSession === "shared") {
            args.push("--continue");
            return { args, continuationMode: "continue" };
          }

          if (sessionId) {
            args.push("--resume", sessionId);
            return { args, continuationMode: "resume" };
          }
        }

        return { args, continuationMode: "none" };
      };

      const runClaudeProcess = async (
        useContinuation: boolean,
      ): Promise<ClaudeRunResult> => {
        const { args, continuationMode } = buildArgs(useContinuation);

        logger.info(
          { command: cmd, args, cwd, continuationMode },
          "Executing Claude CLI",
        );

        return new Promise((resolve) => {
          const proc = spawnEngineProcess(
            cmd,
            args,
            { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
            config.engineEnvFile,
          );

          let stderrOutput = "";
          let lastResult: EngineResult | null = null;
          let currentSessionId: string | undefined;
          let lastAssistantText = "";

          proc.stdout.on("data", (data: Buffer) => {
            const chunk = data.toString();
            const lines = chunk.split("\n").filter((line) => line.trim());

            for (const line of lines) {
              try {
                const event = JSON.parse(line);

                if (
                  event.type === "system" &&
                  event.subtype === "init" &&
                  event.session_id
                ) {
                  currentSessionId = event.session_id;
                }

                if (event.type === "assistant" && event.message?.content) {
                  for (const block of event.message.content) {
                    if (block.type === "text" && block.text) {
                      lastAssistantText = block.text;
                    }

                    if (block.type === "tool_use") {
                      const toolName = block.name || "unknown";
                      let progressMsg = `Using ${toolName}...`;

                      if (toolName === "Read" && block.input?.file_path) {
                        progressMsg = `Reading: ${block.input.file_path}`;
                      } else if (toolName === "Grep" && block.input?.pattern) {
                        progressMsg = `Searching for: ${block.input.pattern}`;
                      } else if (toolName === "Glob" && block.input?.pattern) {
                        progressMsg = `Finding files: ${block.input.pattern}`;
                      } else if (toolName === "Bash" && block.input?.command) {
                        const cmdStr = block.input.command.slice(0, 50);
                        progressMsg = `Running: ${cmdStr}${block.input.command.length > 50 ? "..." : ""}`;
                      } else if (
                        toolName === "Edit" &&
                        block.input?.file_path
                      ) {
                        progressMsg = `Editing: ${block.input.file_path}`;
                      } else if (
                        toolName === "Write" &&
                        block.input?.file_path
                      ) {
                        progressMsg = `Writing: ${block.input.file_path}`;
                      } else if (
                        toolName === "WebSearch" &&
                        block.input?.query
                      ) {
                        progressMsg = `Searching web: ${block.input.query}`;
                      } else if (toolName === "WebFetch" && block.input?.url) {
                        progressMsg = `Fetching: ${block.input.url}`;
                      }

                      logger.info(
                        { tool: toolName, input: block.input },
                        progressMsg,
                      );
                      if (onProgress) {
                        onProgress(progressMsg);
                      }
                    }
                  }
                }

                if (event.type === "user" && event.message?.content) {
                  for (const block of event.message.content) {
                    if (block.type === "tool_result") {
                      const result =
                        typeof block.content === "string"
                          ? block.content.slice(0, 500)
                          : JSON.stringify(block.content).slice(0, 500);
                      logger.info(
                        {
                          toolUseId: block.tool_use_id,
                          isError: block.is_error,
                        },
                        `Tool result: ${result}${result.length >= 500 ? "..." : ""}`,
                      );
                    }
                  }
                }

                if (event.type === "result") {
                  logger.debug({ event }, "Claude result event");
                  const errorMessage = event.is_error
                    ? event.result ||
                      (event.errors?.length
                        ? event.errors.join("; ")
                        : undefined)
                    : undefined;
                  const rawSessionId = event.session_id || currentSessionId;
                  const omitSessionId =
                    config.engineSession === false ||
                    config.engineSession === "shared";
                  lastResult = {
                    success: !event.is_error,
                    output: event.result || lastAssistantText || "",
                    sessionId: omitSessionId ? undefined : rawSessionId,
                    error: errorMessage,
                  };
                }
              } catch {
                // Not valid JSON, ignore
              }
            }
          });

          proc.stderr.on("data", (data: Buffer) => {
            const chunk = data.toString().trim();
            if (chunk) {
              stderrOutput += `${chunk}\n`;
              logger.debug({ stderr: chunk }, "Claude stderr");
            }
          });

          proc.on("close", (code) => {
            logger.debug({ code, continuationMode }, "Claude process closed");

            if (lastResult) {
              resolve({
                result: lastResult,
                stderr: stderrOutput.trim(),
                continuationMode,
              });
              return;
            }

            if (code === 0) {
              const omitSessionId =
                config.engineSession === false ||
                config.engineSession === "shared";
              resolve({
                result: {
                  success: true,
                  output: lastAssistantText || "",
                  sessionId: omitSessionId ? undefined : currentSessionId,
                },
                stderr: stderrOutput.trim(),
                continuationMode,
              });
              return;
            }

            const errorMsg =
              stderrOutput.trim() || `Claude exited with code ${code}`;
            resolve({
              result: {
                success: false,
                output: lastAssistantText,
                error: errorMsg,
              },
              stderr: stderrOutput.trim(),
              continuationMode,
            });
          });

          proc.on("error", (err) => {
            logger.error({ error: err.message }, "Claude process error");
            resolve({
              result: {
                success: false,
                output: "",
                error: `Failed to start ${cmd}: ${err.message}`,
              },
              stderr: "",
              continuationMode,
            });
          });
        });
      };

      if (usesUserResume && sessionId && !isValidClaudeSessionId(sessionId)) {
        const userId = options.gramCtx?.from?.id;
        logger.warn(
          {
            projectSlug: config.slug,
            userId,
            sessionId,
          },
          "Claude session ID is malformed; retrying fresh run",
        );

        const retried = await runClaudeProcess(false);

        if (retried.result.success) {
          return {
            ...retried.result,
            warning: CLAUDE_STALE_SESSION_WARNING,
          };
        }

        logger.error(
          {
            error: retried.result.error,
            output: retried.result.output.slice(0, 1000),
            stderr: retried.stderr,
          },
          "Claude process failed after malformed-session retry",
        );
        return retried.result;
      }

      const initialRun = await runClaudeProcess(true);

      if (shouldRetryClaudeContinuation(initialRun)) {
        const userId = options.gramCtx?.from?.id;
        logger.warn(
          {
            projectSlug: config.slug,
            userId,
            continuationMode: initialRun.continuationMode,
            error: initialRun.result.error,
            output: initialRun.result.output.slice(0, 500),
            stderr: initialRun.stderr,
          },
          "Claude continuation failed; retrying fresh run",
        );

        const retried = await runClaudeProcess(false);

        if (retried.result.success) {
          return {
            ...retried.result,
            warning: CLAUDE_STALE_SESSION_WARNING,
          };
        }

        logger.error(
          {
            error: retried.result.error,
            output: retried.result.output.slice(0, 1000),
            stderr: retried.stderr,
          },
          "Claude process failed after stale-session retry",
        );
        return retried.result;
      }

      if (!initialRun.result.success) {
        logger.error(
          {
            error: initialRun.result.error,
            output: initialRun.result.output.slice(0, 1000),
            stderr: initialRun.stderr,
          },
          "Claude returned error",
        );
      }

      return initialRun.result;
    },

    parse(result: EngineResult): ParsedResponse {
      if (!result.success) {
        return { text: result.error || "An unknown error occurred" };
      }

      try {
        const parsed = JSON.parse(result.output);
        let text = "";

        if (typeof parsed === "string") {
          text = parsed;
        } else if (parsed.result) {
          text = parsed.result;
        } else if (parsed.message) {
          text = parsed.message;
        } else if (parsed.content) {
          if (Array.isArray(parsed.content)) {
            text = parsed.content
              .filter((block: unknown) => {
                const b = block as { type?: string };
                return b.type === "text";
              })
              .map((block: unknown) => {
                const b = block as { text?: string };
                return b.text || "";
              })
              .join("\n");
          } else {
            text = String(parsed.content);
          }
        } else {
          text = JSON.stringify(parsed, null, 2);
        }

        return {
          text: text || "No response received",
          sessionId: result.sessionId ?? parsed.session_id,
          warning: result.warning,
          costUsd: parsed.cost_usd,
          inputTokens: parsed.input_tokens,
          outputTokens: parsed.output_tokens,
        };
      } catch {
        return {
          text: result.output || "No response received",
          sessionId: result.sessionId,
          warning: result.warning,
        };
      }
    },

    skillsDirs(projectCwd: string): string[] {
      return [join(projectCwd, ".claude", "skills")];
    },

    instructionsFile(): string {
      return "CLAUDE.md";
    },
  };
}
