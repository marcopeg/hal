import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface CronLogEntry {
  jobName: string;
  sourceFile: string;
  startedAt: Date;
  finishedAt: Date;
  output: string;
  error?: string;
}

/**
 * Write a cron execution log to:
 *   {logBaseDir}/.hal/logs/crons/{jobName}/{timestamp}.{jobName}.txt
 *
 * One folder per job name. Timestamp-first for sorting; job name repeated for portability.
 */
export function writeCronLog(logBaseDir: string, entry: CronLogEntry): void {
  const logDir = join(logBaseDir, ".hal", "logs", "crons", entry.jobName);
  mkdirSync(logDir, { recursive: true });

  const ts = entry.startedAt
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("Z", "");
  const filename = `${ts}.${entry.jobName}.txt`;
  const filePath = join(logDir, filename);

  const lines = [
    `job:     ${entry.jobName}`,
    `source:  ${entry.sourceFile}`,
    `started: ${entry.startedAt.toISOString()}`,
    `ended:   ${entry.finishedAt.toISOString()}`,
    `status:  ${entry.error ? "error" : "ok"}`,
    "",
    "--- output ---",
    entry.output,
  ];
  if (entry.error) {
    lines.push("", "--- error ---", entry.error);
  }

  appendFileSync(filePath, `${lines.join("\n")}\n`, "utf-8");
}
