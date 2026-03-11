import { basename } from "node:path";
import { resolveScheduleEnds } from "./schedule.js";
import type {
  CronContext,
  MjsCronDefinition,
  ProjectCronContext,
  ProjectMjsCronDefinition,
} from "./types.js";

/** Coerce a mod.scheduleEnds export (string | Date | undefined) to a Date. */
function readScheduleEnds(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  return resolveScheduleEnds(String(val));
}

/**
 * Dynamically import a system-tier .mjs cron module and validate its exports.
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

  return {
    type: "mjs",
    tier: "system",
    name: basename(filePath, ".mjs"),
    sourceFile: filePath,
    schedule: typeof mod.schedule === "string" ? mod.schedule : undefined,
    runAt: mod.runAt ? new Date(mod.runAt as string) : undefined,
    scheduleEnds: readScheduleEnds(mod.scheduleEnds),
    enabled: mod.enabled === true,
    handler: mod.handler as (ctx: CronContext) => Promise<void>,
  };
}

/**
 * Dynamically import a project-tier .mjs cron module and validate its exports.
 * Handler receives ProjectCronContext (flat, single project) instead of CronContext.
 */
export async function loadProjectMjsCron(
  filePath: string,
): Promise<ProjectMjsCronDefinition> {
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

  const runAs =
    typeof mod.runAs === "number"
      ? mod.runAs
      : typeof mod.runAs === "string" && mod.runAs !== ""
        ? parseInt(mod.runAs, 10)
        : undefined;

  return {
    type: "mjs",
    tier: "project",
    name: basename(filePath, ".mjs"),
    sourceFile: filePath,
    schedule: typeof mod.schedule === "string" ? mod.schedule : undefined,
    runAt: mod.runAt ? new Date(mod.runAt as string) : undefined,
    scheduleEnds: readScheduleEnds(mod.scheduleEnds),
    enabled: mod.enabled === true,
    runAs: runAs !== undefined && !isNaN(runAs) ? runAs : undefined,
    handler: mod.handler as (ctx: ProjectCronContext) => Promise<void>,
  };
}
