import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parse as parseYaml } from "yaml";
import { MdFrontmatterSchema } from "./schema.js";
import type { MdCronDefinition } from "./types.js";

/**
 * Parse a .md cron file into a validated MdCronDefinition.
 *
 * Throws on schema validation failure.
 * For flowResult+userId mismatch: throws an Error with { soft: true } when strict=false,
 * or a plain Error when strict=true. Callers in hot-reload mode can distinguish soft errors.
 */
export function loadMdCron(
  filePath: string,
  options: { strict: boolean },
): MdCronDefinition {
  const raw = readFileSync(filePath, "utf-8");

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`No YAML frontmatter found in ${filePath}`);
  }

  const [, frontmatterRaw, body] = match;
  const parsed = parseYaml(frontmatterRaw);
  const result = MdFrontmatterSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid frontmatter in ${filePath}: ${result.error.message}`,
    );
  }

  const fm = result.data;

  for (const target of fm.targets) {
    if (target.flowResult && !target.userId) {
      const msg = `flowResult: true requires userId in target (projectId="${target.projectId}") in ${filePath}`;
      if (options.strict) {
        throw new Error(msg);
      }
      throw Object.assign(new Error(msg), { soft: true });
    }
  }

  return {
    type: "md",
    name: basename(filePath, ".md"),
    sourceFile: filePath,
    schedule: fm.schedule,
    runAt: fm.runAt ? new Date(fm.runAt) : undefined,
    enabled: fm.enabled,
    targets: fm.targets,
    prompt: body.trim(),
  };
}
