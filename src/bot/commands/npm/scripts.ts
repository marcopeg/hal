import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export class NpmScriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NpmScriptError";
  }
}

/**
 * Read the `scripts` map from `<cwd>/package.json`.
 * Throws NpmScriptError when the file is missing, unreadable, or has no scripts.
 */
export function readPackageScripts(cwd: string): Record<string, string> {
  const pkgPath = join(cwd, "package.json");

  if (!existsSync(pkgPath)) {
    throw new NpmScriptError(
      `No package.json found in ${cwd}. Cannot run npm scripts.`,
    );
  }

  let raw: string;
  try {
    raw = readFileSync(pkgPath, "utf-8");
  } catch (err) {
    throw new NpmScriptError(
      `Cannot read package.json: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let pkg: unknown;
  try {
    pkg = JSON.parse(raw);
  } catch (err) {
    throw new NpmScriptError(
      `Invalid JSON in package.json: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const scripts =
    pkg !== null && typeof pkg === "object" && "scripts" in pkg
      ? (pkg as { scripts: unknown }).scripts
      : undefined;

  if (
    scripts === undefined ||
    scripts === null ||
    typeof scripts !== "object" ||
    Object.keys(scripts as object).length === 0
  ) {
    throw new NpmScriptError(
      "package.json has no scripts defined. Nothing to run.",
    );
  }

  return scripts as Record<string, string>;
}

/**
 * Resolve the effective list of allowed scripts from available scripts,
 * an optional whitelist, and an optional blacklist.
 *
 * - whitelist present → allowed = available ∩ whitelist
 * - else → allowed = available
 * - blacklist present → allowed = allowed \ blacklist
 */
export function resolveAllowedScripts(
  available: string[],
  whitelist?: string[],
  blacklist?: string[],
): string[] {
  let allowed: string[];

  if (whitelist && whitelist.length > 0) {
    const whiteSet = new Set(whitelist);
    allowed = available.filter((s) => whiteSet.has(s));
  } else {
    allowed = [...available];
  }

  if (blacklist && blacklist.length > 0) {
    const blackSet = new Set(blacklist);
    allowed = allowed.filter((s) => !blackSet.has(s));
  }

  return allowed;
}
