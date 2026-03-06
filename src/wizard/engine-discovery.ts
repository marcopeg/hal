import { spawn } from "node:child_process";

export type EngineName =
  | "claude"
  | "copilot"
  | "codex"
  | "opencode"
  | "cursor"
  | "antigravity";

const DEFAULT_ENGINE_COMMAND: Record<EngineName, string> = {
  claude: "claude",
  copilot: "copilot",
  codex: "codex",
  opencode: "opencode",
  cursor: "agent",
  antigravity: "gemini",
};

function runVersionCheck(command: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(command, ["--version"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    const timer = setTimeout(() => {
      try {
        proc.kill();
      } catch {}
      resolve(false);
    }, timeoutMs);
    proc.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

/**
 * Async (non-blocking) engine availability discovery.
 * Runs `<cmd> --version` checks in parallel (with a per-engine timeout).
 */
export async function discoverAvailableEngines(
  timeoutMsPerEngine = 1500,
): Promise<EngineName[]> {
  const engines: EngineName[] = [
    "claude",
    "copilot",
    "codex",
    "opencode",
    "cursor",
    "antigravity",
  ];
  const checks = await Promise.all(
    engines.map(async (e) => {
      const cmd = DEFAULT_ENGINE_COMMAND[e];
      const ok = await runVersionCheck(cmd, timeoutMsPerEngine);
      return ok ? e : null;
    }),
  );
  return checks.filter((x): x is EngineName => x !== null);
}

export function defaultEngineCommand(engine: EngineName): string {
  return DEFAULT_ENGINE_COMMAND[engine];
}
