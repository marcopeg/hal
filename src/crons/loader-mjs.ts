import { basename } from "node:path";
import type { CronContext, MjsCronDefinition } from "./types.js";

/**
 * Dynamically import a .mjs cron module and validate its exports.
 * Cache-busts with ?t= to pick up file changes on hot reload
 * (matches the existing pattern in src/context/resolver.ts).
 * Throws a descriptive error if required exports are missing or invalid.
 */
export async function loadMjsCron(
  filePath: string,
): Promise<MjsCronDefinition> {
  const url = `${filePath}?t=${Date.now()}`;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const mod = await import(url);

  if (typeof mod.handler !== "function") {
    throw new Error(`Missing exported handler() function in ${filePath}`);
  }
  if (!mod.schedule && !mod.runAt) {
    throw new Error(`Missing schedule or runAt export in ${filePath}`);
  }
  if (mod.schedule && mod.runAt) {
    throw new Error(
      `Only one of schedule or runAt may be exported in ${filePath}`,
    );
  }

  const nameFromFile = basename(filePath, ".mjs");

  return {
    type: "mjs",
    name: typeof mod.name === "string" ? mod.name : nameFromFile,
    sourceFile: filePath,
    schedule: typeof mod.schedule === "string" ? mod.schedule : undefined,
    runAt: mod.runAt ? new Date(mod.runAt as string) : undefined,
    handler: mod.handler as (ctx: CronContext) => Promise<void>,
  };
}
