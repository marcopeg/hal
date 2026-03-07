import type { NpmResult } from "./exec.js";

/**
 * Build a human-readable summary of an npm script run.
 * Logs are truncated from the tail to fit `maxChars`.
 */
export function formatNpmResult(
  script: string,
  result: NpmResult,
  maxChars: number,
): { summary: string; fullLog: string; truncated: boolean } {
  const statusIcon = result.timedOut
    ? "⏱"
    : result.exitCode === 0
      ? "✅"
      : "❌";

  const statusLabel = result.timedOut
    ? "timed out"
    : result.exitCode === 0
      ? "success"
      : "failed";

  const exitStr =
    result.exitCode !== null ? `exit ${result.exitCode}` : "no exit code";

  const durationStr = (result.durationMs / 1000).toFixed(1);

  const fullLog = [result.stdout, result.stderr].filter(Boolean).join("\n");

  const header = `📦 npm run ${script}\nStatus: ${statusIcon} ${statusLabel} (${exitStr})\nDuration: ${durationStr}s`;

  const budgetForLogs = maxChars - header.length - 20;

  let logBlock: string;
  let truncated = false;

  if (fullLog.length === 0) {
    logBlock = "(no output)";
  } else if (fullLog.length <= budgetForLogs) {
    logBlock = `\`\`\`\n${fullLog}\n\`\`\``;
  } else {
    truncated = true;
    const tail = fullLog.slice(-budgetForLogs);
    logBlock = `\`\`\`\n…(truncated)\n${tail}\n\`\`\``;
  }

  return {
    summary: `${header}\n\n${logBlock}`,
    fullLog,
    truncated,
  };
}
