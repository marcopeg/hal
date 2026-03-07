import { spawn } from "node:child_process";

export interface NpmResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

/**
 * Run `npm run <script>` in the given cwd with a hard timeout.
 *
 * On timeout the process is terminated with a graceful escalation:
 * SIGINT → 3 s → SIGTERM → 2 s → SIGKILL.
 */
export function npmExec(
  cwd: string,
  script: string,
  timeoutMs: number,
): Promise<NpmResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    let timedOut = false;
    let stdoutBuf = "";
    let stderrBuf = "";

    const child = spawn("npm", ["run", script], {
      cwd,
      stdio: "pipe",
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    let killTimer: ReturnType<typeof setTimeout> | undefined;

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGINT");

      killTimer = setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGTERM");
          killTimer = setTimeout(() => {
            if (!child.killed) {
              child.kill("SIGKILL");
            }
          }, 2_000);
        }
      }, 3_000);
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);

      resolve({
        stdout: stdoutBuf,
        stderr: stderrBuf,
        exitCode: code,
        timedOut,
        durationMs: Date.now() - start,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);

      resolve({
        stdout: stdoutBuf,
        stderr: `${stderrBuf}\n${err.message}`,
        exitCode: null,
        timedOut: false,
        durationMs: Date.now() - start,
      });
    });
  });
}
