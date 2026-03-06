import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CODEX_SESSIONS_DIR = join(homedir(), ".codex", "sessions");

/**
 * Pattern for Codex session JSONL filenames: rollout-<timestamp>-<UUID>.jsonl
 * UUID is the last segment before .jsonl.
 */
const ROLLOUT_FILENAME_REGEX = /^rollout-.+-([a-f0-9-]+)\.jsonl$/i;

/**
 * Recursively collect paths of rollout-*.jsonl files under dir, sorted by mtime newest first.
 */
function findRolloutJsonlFiles(dir: string): { path: string; mtime: number }[] {
  const results: { path: string; mtime: number }[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      try {
        if (e.isDirectory()) {
          results.push(...findRolloutJsonlFiles(full));
        } else if (e.isFile() && ROLLOUT_FILENAME_REGEX.test(e.name)) {
          const stat = statSync(full);
          results.push({ path: full, mtime: stat.mtimeMs });
        }
      } catch {
        // Skip inaccessible or unreadable entries
      }
    }
  } catch {
    // Dir may not exist or be unreadable
  }
  return results.sort((a, b) => b.mtime - a.mtime);
}

/**
 * Read the first few lines of a JSONL file and try to extract a "cwd" field from any line.
 */
function readCwdFromJsonl(filePath: string): string | undefined {
  try {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n").slice(0, 20);
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t) as Record<string, unknown>;
        if (typeof obj.cwd === "string") return obj.cwd;
      } catch {
        // Not valid JSON or no cwd
      }
    }
  } catch {
    // File read error
  }
  return undefined;
}

/**
 * Extract UUID from a rollout filename (e.g. rollout-2025-03-05T12-00-00-abc123.jsonl -> abc123).
 */
function uuidFromFilename(filename: string): string | undefined {
  const m = filename.match(ROLLOUT_FILENAME_REGEX);
  return m ? m[1] : undefined;
}

/**
 * Find the most recent Codex session file under ~/.codex/sessions whose embedded cwd
 * matches the given project cwd. Returns the session UUID from the filename, or undefined.
 * Experimental: relies on Codex's internal filesystem layout.
 */
export function findLatestCodexSessionUuidForCwd(
  projectCwd: string,
): string | undefined {
  const files = findRolloutJsonlFiles(CODEX_SESSIONS_DIR);
  const normalizedCwd = projectCwd.replace(/\/$/, "") || "/";
  for (const { path } of files) {
    const cwd = readCwdFromJsonl(path);
    const fileCwd = cwd?.replace(/\/$/, "") || "";
    if (fileCwd && (fileCwd === normalizedCwd || fileCwd === projectCwd)) {
      const uuid = uuidFromFilename(path.split(/[/\\]/).pop() ?? "");
      if (uuid) return uuid;
    }
  }
  return undefined;
}
