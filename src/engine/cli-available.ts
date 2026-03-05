import { execSync } from "node:child_process";
import type { EngineName } from "./types.js";
import { ENGINE_NAMES } from "./types.js";

/** Default CLI command per engine (for availability check and adapter). */
const DEFAULT_ENGINE_COMMAND: Record<EngineName, string> = {
  claude: "claude",
  copilot: "copilot",
  codex: "codex",
  opencode: "opencode",
  cursor: "agent",
  antigravity: "gemini",
};

/**
 * Returns true if the given CLI command is available (runs `command --version`).
 * Fast check only; does not run any heavy or network operation.
 * @param timeoutMs - Max wait per check (default 3000). Use a lower value for boot-time discovery.
 */
export function isCliAvailable(command: string, timeoutMs = 3000): boolean {
  try {
    execSync(`${command} --version`, {
      stdio: "pipe",
      timeout: timeoutMs,
      encoding: "utf-8",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * When no `providers` key is set, run a fast check per engine (e.g. `command
 * --help` / `--version`) and return the list of engines whose CLI is available.
 * Used to enable /engine when config has no providers.
 */
export function getAvailableEnginesFromCli(): EngineName[] {
  const available: EngineName[] = [];
  for (const name of ENGINE_NAMES) {
    const command = DEFAULT_ENGINE_COMMAND[name];
    if (isCliAvailable(command, 2000)) available.push(name);
  }
  return available;
}
