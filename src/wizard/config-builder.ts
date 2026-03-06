import { stringify as stringifyYaml } from "yaml";
import type { ConfigFormat } from "../config.js";
import type { PartialConfig, WizardContext } from "./types.js";

export interface BuildResult {
  content: string;
  targetPath: string;
  /** Key-value pairs to append to .env (e.g. bot token). */
  envEntries?: Record<string, string>;
  /** If secretsMode=env, the env file contents we plan to write. */
  envPath?: string;
}

const DOCS_CONFIG =
  "https://github.com/marcopeg/hal/blob/main/docs/config/README.md";

/**
 * Build the final config object by merging wizard results over the existing
 * config (if any), then serialize it in the appropriate format.
 */
export function buildConfigFromResults(ctx: WizardContext): BuildResult {
  const results = ctx.results as Record<string, unknown>;
  const secretsMode =
    (results.secretsMode as "env" | "inline" | undefined) ?? "env";

  // Determine project key and name
  const projectKey =
    (results.projectKey as string | undefined) ??
    (ctx.existingConfig?.projects
      ? Object.keys(ctx.existingConfig.projects)[0]
      : undefined) ??
    "prj1";

  const projectName = results.projectName as string | undefined;

  // Start from existing config or a fresh skeleton
  const base: PartialConfig = ctx.existingConfig
    ? JSON.parse(JSON.stringify(ctx.existingConfig)) // deep clone
    : {};

  // Ensure projects map exists
  if (!base.projects) base.projects = {};
  if (!base.projects[projectKey]) base.projects[projectKey] = {};

  const project = base.projects[projectKey];

  // Apply project name
  if (projectName) {
    project.name = projectName;
  } else {
    delete project.name;
  }

  // Apply cwd
  if (results.cwd) {
    project.cwd = results.cwd as string;
  }

  // Engines enabled (providers) + default engine (globals)
  if (Array.isArray(results.enabledEngines)) {
    // Create a providers map that enables /engine switching.
    // Use null so it stays lean; runtime CLI discovery can still populate names.
    const enabled = results.enabledEngines as string[];
    base.providers = base.providers ?? ({} as unknown);
    const providers: Record<string, unknown> = {};
    for (const e of enabled) providers[e] = null;
    (base as unknown as { providers?: unknown }).providers = providers;
  }

  if (results.engine || results.model || results.session !== undefined) {
    base.globals = base.globals ?? {};
    base.globals.engine = base.globals.engine ?? {};
    const globalsEngine = base.globals.engine as {
      name?: string;
      model?: string;
      session?: unknown;
    };
    if (results.engine) globalsEngine.name = results.engine as string;
    if (results.model) globalsEngine.model = results.model as string;
    if (results.session !== undefined) {
      globalsEngine.session = results.session as boolean | "shared" | "user";
    }

    // Keep project config lean: remove project.engine when it only duplicates globals
    if (project.engine && results.engine) {
      const pe = project.engine;
      const sameName = pe.name === globalsEngine.name;
      const sameModel =
        (pe as { model?: string }).model === globalsEngine.model;
      const sameSession =
        (pe as { session?: unknown }).session === globalsEngine.session ||
        (pe as { session?: unknown }).session === undefined;
      if (sameName && sameModel && sameSession) {
        delete project.engine;
      }
    }
  }

  // Secrets: bot token + user IDs can be inline or via .env placeholders
  let envEntries: Record<string, string> | undefined;
  if (results.botToken) {
    const token = results.botToken as string;
    if (!project.telegram) project.telegram = {};
    if (secretsMode === "inline") {
      project.telegram.botToken = token;
    } else {
      // Intentional config placeholder — not a template literal
      project.telegram.botToken = "$" + "{TELEGRAM_BOT_TOKEN}";
      envEntries = { ...(envEntries ?? {}), TELEGRAM_BOT_TOKEN: token };
    }
  }

  // Apply user IDs to globals.access
  const allUserIds: number[] = [];
  if (results.userId) allUserIds.push(results.userId as number);
  if (Array.isArray(results.additionalUserIds)) {
    allUserIds.push(...(results.additionalUserIds as number[]));
  }
  if (allUserIds.length > 0) {
    base.globals = base.globals ?? {};
    base.globals.access = base.globals.access ?? {};
    if (secretsMode === "inline") {
      base.globals.access.allowedUserIds = allUserIds;
    } else {
      const placeholders: string[] = [];
      allUserIds.forEach((id, idx) => {
        const key =
          idx === 0 ? "TELEGRAM_USER_ID" : `TELEGRAM_USER_ID_${idx + 1}`;
        placeholders.push(`\${${key}}`);
        envEntries = { ...(envEntries ?? {}), [key]: String(id) };
      });
      base.globals.access.allowedUserIds = placeholders;
    }
  }

  // Serialize
  const format: ConfigFormat = ctx.existingConfigFormat ?? "yaml";
  const targetPath = ctx.existingConfigPath ?? `${ctx.cwd}/hal.config.yaml`;

  let content: string;
  if (format === "yaml") {
    content = buildYamlContent(base);
  } else {
    content = `${JSON.stringify(base, null, 2)}\n`;
  }

  return { content, targetPath, envEntries };
}

function buildYamlContent(config: PartialConfig): string {
  const header = [
    "# HAL configuration",
    `# Full config docs: ${DOCS_CONFIG}`,
    "",
  ].join("\n");
  const body = stringifyYaml(config, { indent: 2 });
  return `${header}\n${body}`;
}
