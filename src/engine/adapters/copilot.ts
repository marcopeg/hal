import { execSync } from "node:child_process";
import { join } from "node:path";
import type { ProjectContext } from "../../types.js";
import { parseCopilotStructuredOutput } from "../copilot-output.js";
import { buildContextualPrompt } from "../prompt.js";
import { spawnEngineProcess } from "../spawn.js";
import type {
  EngineAdapter,
  EngineExecuteOptions,
  EngineResult,
  ParsedResponse,
} from "../types.js";

const DEFAULT_COMMAND = "copilot";
const PLACEHOLDER_SESSION_ID = "active";

const COPILOT_SESSION_DISCOVERY_WARNING =
  "Warning: HAL could not recover your Copilot session ID. This reply was processed, but future messages will start fresh sessions until session recovery works again.";

const COPILOT_STALE_RESUME_WARNING =
  "Warning: HAL could not resume your previous Copilot session, so this reply was processed in a fresh session. Session continuity was reset for future messages.";

/**
 * Best-effort extraction of the final answer when Copilot falls back to plain
 * text instead of the expected JSONL event stream.
 */
function extractFinalAnswer(output: string): string | undefined {
  const lines = output.split(/\r?\n/);
  // Recurring patterns: markdown headers (## Answer, ## Summary), bold labels
  // (**Answer:**), and natural-language lead-ins (Here are the..., Answer:, etc.).
  const leadInPatterns = [
    /^#{1,6}\s*(Answer|Summary|Result|Output|Final answer|Conclusion)\s*$/i,
    /^\*\*(Answer|Summary|Result|Output):\s*\*\*/i,
    /^(Here are the |Here is the )/i,
    /^(Answer|Summary|Result|Output|Conclusion):\s*/i,
    /^(Final answer|In summary|To summarize):\s*/i,
    /^The (last |following )?\d+ (commits?|results?|items?):\s*/i,
  ];
  let lastMatchIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (leadInPatterns.some((re) => re.test(line))) lastMatchIndex = i;
  }
  if (lastMatchIndex < 0) return undefined;
  const slice = lines.slice(lastMatchIndex).join("\n").trim();
  return slice.length > 20 ? slice : undefined;
}

interface CopilotProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function isCopilotResumeRecoveryError(stderr: string, stdout: string): boolean {
  const text = `${stderr}\n${stdout}`.toLowerCase();
  const referencesResume =
    text.includes("resume") ||
    text.includes("session") ||
    text.includes("uuid");
  const indicatesMissingState =
    text.includes("not found") ||
    text.includes("no such") ||
    text.includes("invalid") ||
    text.includes("unknown") ||
    text.includes("expired") ||
    text.includes("does not exist") ||
    text.includes("unable to") ||
    text.includes("cannot");
  return referencesResume && indicatesMissingState;
}

export function createCopilotAdapter(
  command?: string,
  model?: string,
): EngineAdapter {
  const cmd = command || DEFAULT_COMMAND;

  return {
    name: "GitHub Copilot",
    command: cmd,
    sessionCapabilities: {
      supportsUserIsolation: true,
      defaultMode: "user",
      sharedContinuationRequiresMarker: true,
    },

    check() {
      try {
        execSync(`${cmd} --version`, { stdio: "pipe" });
      } catch {
        throw new Error(
          `Copilot CLI command "${cmd}" not found or not executable. ` +
            `Please ensure GitHub Copilot CLI is installed and the command is in your PATH.`,
        );
      }
    },

    async execute(
      options: EngineExecuteOptions,
      ctx: ProjectContext,
    ): Promise<EngineResult> {
      const { onProgress, continueSession, sessionId } = options;
      const { config, logger } = ctx;

      const fullPrompt = await buildContextualPrompt(options, ctx);

      // Copilot CLI flags (confirmed via `copilot --help`):
      //   -p <text>             Non-interactive prompt (exits after completion)
      //   --allow-all-tools     Allow all tools without confirmation (required for non-interactive mode)
      //   --allow-all-urls      Allow all URL access without confirmation
      //   --allow-all-paths     Disable path verification (access any file on disk)
      //   --model <model>       Override the AI model
      //   --continue            Continue the most recent session
      //   --output-format json  Emit JSONL events, including a final result object
      //   --stream off          Return completed JSONL output instead of live streaming
      //
      // We intentionally do NOT use --allow-all (which would add --allow-all-paths).
      // By default Copilot is restricted to the project cwd and its subdirectories.
      // Set engine.copilot.allowAllPaths: true in config to opt into unrestricted access.
      const cwd = config.cwd;
      const sessionEnabled = config.engineSession !== false;
      const useResumeByUuid =
        sessionEnabled &&
        config.engineSession === "user" &&
        continueSession !== false &&
        typeof sessionId === "string" &&
        sessionId !== PLACEHOLDER_SESSION_ID;
      const useSharedContinue =
        sessionEnabled &&
        config.engineSession !== "user" &&
        sessionId != null &&
        continueSession !== false;

      const runCopilotProcess = async (copilotArgs: string[]) =>
        new Promise<CopilotProcessResult>((resolve) => {
          logger.info(
            {
              command: cmd,
              cwd,
              resume: copilotArgs.includes("--resume")
                ? "uuid"
                : copilotArgs.includes("--continue")
                  ? "shared"
                  : "none",
            },
            "Executing Copilot CLI",
          );

          const proc = spawnEngineProcess(
            cmd,
            copilotArgs,
            { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
            config.engineEnvFile,
          );

          let stdout = "";
          let stderrOutput = "";

          proc.stdout.on("data", (data: Buffer) => {
            const chunk = data.toString();
            stdout += chunk;

            if (onProgress && chunk.trim()) {
              onProgress("Copilot is responding...");
            }
          });

          proc.stderr.on("data", (data: Buffer) => {
            const chunk = data.toString().trim();
            if (chunk) {
              stderrOutput += `${chunk}\n`;
              logger.info({ stderr: chunk }, "Copilot stderr");
            }
          });

          proc.on("close", (code) => {
            logger.info({ code }, "Copilot process closed");
            resolve({
              code,
              stdout: stdout.trim(),
              stderr: stderrOutput.trim(),
            });
          });

          proc.on("error", (err) => {
            logger.error({ error: err.message }, "Copilot process error");
            resolve({
              code: -1,
              stdout: "",
              stderr: `Failed to start ${cmd}: ${err.message}`,
            });
          });
        });

      const buildArgs = (sessionFlags?: string[]): string[] => {
        const args: string[] = [];

        if (sessionFlags) {
          args.push(...sessionFlags);
        }

        args.push("-p", fullPrompt, "--allow-all-tools", "--allow-all-urls");

        args.push("--output-format", "json", "--stream", "off");

        if (config.copilot.allowAllPaths) {
          args.push("--allow-all-paths");
        }

        if (model) {
          args.push("--model", model);
        }

        return args;
      };

      const finalizeFreshSuccess = (
        processResult: CopilotProcessResult,
        warning?: string,
      ): EngineResult => {
        const structured = parseCopilotStructuredOutput(processResult.stdout);
        let resultSessionId: string | undefined;
        let nextWarning = warning;

        if (sessionEnabled) {
          if (config.engineSession === "user") {
            resultSessionId = structured.sessionId;

            if (!resultSessionId) {
              logger.warn(
                { cwd },
                "Copilot user session ID recovery failed from structured output",
              );
              nextWarning = nextWarning
                ? `${nextWarning} HAL could not recover a new Copilot session ID from Copilot's structured output for future continuity.`
                : COPILOT_SESSION_DISCOVERY_WARNING;
            }
          } else {
            resultSessionId = PLACEHOLDER_SESSION_ID;
          }
        }

        return {
          success: true,
          output:
            structured.responseText ||
            processResult.stdout ||
            "No response received",
          sessionId: resultSessionId,
          warning: nextWarning,
        };
      };

      if (useResumeByUuid && sessionId) {
        const resumed = await runCopilotProcess(
          buildArgs(["--resume", sessionId]),
        );
        const structured = parseCopilotStructuredOutput(resumed.stdout);

        if (resumed.code === 0) {
          return {
            success: true,
            output:
              structured.responseText ||
              resumed.stdout ||
              "No response received",
            sessionId: structured.sessionId || sessionId,
          };
        }

        if (!isCopilotResumeRecoveryError(resumed.stderr, resumed.stdout)) {
          logger.error(
            { code: resumed.code, stderr: resumed.stderr },
            "Copilot process failed",
          );
          return {
            success: false,
            output: resumed.stdout,
            error: resumed.stderr || `Copilot exited with code ${resumed.code}`,
          };
        }

        logger.warn(
          { cwd, sessionId, stderr: resumed.stderr },
          "Copilot user session resume failed; retrying fresh run",
        );

        const retried = await runCopilotProcess(buildArgs());

        if (retried.code === 0) {
          return finalizeFreshSuccess(retried, COPILOT_STALE_RESUME_WARNING);
        }

        logger.error(
          { code: retried.code, stderr: retried.stderr },
          "Copilot process failed after stale-session retry",
        );
        return {
          success: false,
          output: retried.stdout,
          error: retried.stderr || `Copilot exited with code ${retried.code}`,
        };
      }

      const result = await runCopilotProcess(
        buildArgs(useSharedContinue ? ["--continue"] : undefined),
      );

      if (result.code === 0) {
        return finalizeFreshSuccess(result);
      }

      logger.error(
        { code: result.code, stderr: result.stderr },
        "Copilot process failed",
      );
      return {
        success: false,
        output: result.stdout,
        error: result.stderr || `Copilot exited with code ${result.code}`,
      };
    },

    parse(result: EngineResult): ParsedResponse {
      if (!result.success) {
        return { text: result.error || "An unknown error occurred" };
      }
      const raw = (result.output || "No response received").trim();
      const extracted = extractFinalAnswer(raw);
      return {
        text: extracted ?? raw,
        sessionId: result.sessionId,
        warning: result.warning,
      };
    },

    skillsDirs(projectCwd: string): string[] {
      return [
        join(projectCwd, ".agents", "skills"),
        join(projectCwd, ".github", "skills"),
        join(projectCwd, ".claude", "skills"),
      ];
    },

    instructionsFile(): string {
      return "AGENTS.md";
    },
  };
}
