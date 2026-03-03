import { readFileSync, writeFileSync } from "node:fs";
import { stringify as stringifyYaml } from "yaml";
import {
  type ConfigFormat,
  parseConfigContent,
  resolveConfigFile,
} from "./config.js";
import type { EngineName } from "./engine/types.js";

function serializeConfig(
  data: Record<string, unknown>,
  format: ConfigFormat,
): string {
  if (format === "yaml") {
    return stringifyYaml(data, { indent: 2 });
  }
  // jsonc → plain JSON on write (comments are not preserved)
  return JSON.stringify(data, null, 2);
}

export function updateProjectModel(
  configDir: string,
  projectSlug: string,
  engine: EngineName,
  model: string,
): void {
  const localResolved = resolveConfigFile(configDir, "hal.config.local");
  const baseResolved = resolveConfigFile(configDir, "hal.config");

  const target = localResolved ?? baseResolved;
  if (!target) return;

  let data: Record<string, unknown>;
  try {
    const content = readFileSync(target.path, "utf-8");
    data = parseConfigContent(content, target.format, target.path) as Record<
      string,
      unknown
    >;
  } catch {
    data = {};
  }

  const projects = data.projects;

  if (
    projects !== null &&
    typeof projects === "object" &&
    !Array.isArray(projects)
  ) {
    const entry = (projects as Record<string, unknown>)[projectSlug] as
      | Record<string, unknown>
      | undefined;
    if (entry) {
      const engineConfig = (entry.engine as Record<string, unknown>) ?? {};
      engineConfig.name = engine;
      engineConfig.model = model;
      entry.engine = engineConfig;
    }
    // If project key not found, do not add new projects (per task: local keys must exist in base)
  }

  writeFileSync(target.path, serializeConfig(data, target.format), "utf-8");
}
