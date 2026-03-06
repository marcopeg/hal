import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { confirm, text } from "@clack/prompts";
import { parse as parseEnv } from "dotenv";
import { resolveCustomEnvPaths } from "../../config.js";
import { guardCancel } from "../runner.js";
import type { WizardContext, WizardStep } from "../types.js";

const TELEGRAM_USER_ID_MAX = 0xfffffffff;
const HELP_URL =
  "https://github.com/marcopeg/hal/blob/main/docs/telegram/README.md";

/** Placeholder pattern — e.g. "${SOME_VAR}" */
const PLACEHOLDER_RE = /^\$\{[^}]+\}$/;

function isPlaceholder(value: unknown): boolean {
  return typeof value === "string" && PLACEHOLDER_RE.test(value.trim());
}

function placeholderVar(value: unknown): string | null {
  if (!isPlaceholder(value)) return null;
  const s = (value as string).trim();
  return s.slice(2, -1).trim() || null;
}

function parseUserId(raw: string): number | null {
  const str = raw.trim();
  const num = Number(str);
  if (!Number.isFinite(num) || !Number.isInteger(num)) return null;
  if (num < 1 || num > TELEGRAM_USER_ID_MAX) return null;
  return num;
}

function loadEnvFromConfigDir(configDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of [join(configDir, ".env"), join(configDir, ".env.local")]) {
    if (!existsSync(file)) continue;
    try {
      const parsed = parseEnv(readFileSync(file, "utf-8"));
      Object.assign(out, parsed);
    } catch {
      // ignore
    }
  }
  return out;
}

function loadEnvForConfig(
  configDir: string,
  parsed: { env?: unknown } | null,
): Record<string, string> {
  if (parsed && typeof parsed.env === "string" && parsed.env.trim() !== "") {
    const { mainPath, localPath } = resolveCustomEnvPaths(
      configDir,
      parsed.env,
    );
    const out: Record<string, string> = {};
    for (const file of [mainPath, localPath]) {
      if (!existsSync(file)) continue;
      try {
        const parsedEnv = parseEnv(readFileSync(file, "utf-8"));
        Object.assign(out, parsedEnv);
      } catch {
        // ignore
      }
    }
    return out;
  }
  return loadEnvFromConfigDir(configDir);
}

function hasResolvableId(
  ids: unknown[] | undefined,
  env: Record<string, string>,
): boolean {
  if (!ids || ids.length === 0) return false;
  return ids.some((id) => {
    if (typeof id === "number") return id > 0;
    if (typeof id !== "string") return false;

    const trimmed = id.trim();

    // Raw numeric string
    if (!PLACEHOLDER_RE.test(trimmed)) return parseUserId(trimmed) !== null;

    // Placeholder: resolve via process env or .env/.env.local (or custom env path)
    const varName = placeholderVar(trimmed);
    if (!varName) return false;
    const raw = (process.env[varName] ?? env[varName]) || "";
    return parseUserId(raw) !== null;
  });
}

function hasRealId(ids: unknown[] | undefined): boolean {
  if (!ids || ids.length === 0) return false;
  return ids.some((id) => {
    if (typeof id === "number") return id > 0;
    if (typeof id === "string") return parseUserId(id) !== null;
    return false;
  });
}

export const userIdStep: WizardStep = {
  id: "user-id",
  label: "Your Telegram user ID",

  isConfigured(ctx: WizardContext): boolean {
    const env = loadEnvForConfig(ctx.cwd, ctx.existingConfig);
    const globalIds = ctx.existingConfig?.globals?.access?.allowedUserIds;
    const projects = ctx.existingConfig?.projects ?? {};
    const projectIds = Object.values(projects).flatMap(
      (p) => p.access?.allowedUserIds ?? [],
    );
    return (
      hasResolvableId(globalIds, env) ||
      hasResolvableId(projectIds, env) ||
      // Back-compat: treat raw numeric strings/numbers as configured too
      hasRealId(globalIds) ||
      hasRealId(projectIds)
    );
  },

  shouldSkip(ctx: WizardContext): boolean {
    if (!ctx.prefill.userId) return false;
    return parseUserId(ctx.prefill.userId) !== null;
  },

  run: async (ctx: WizardContext) => {
    if (ctx.prefill.userId) {
      const n = parseUserId(ctx.prefill.userId);
      if (n !== null) {
        ctx.results.userId = n;
        return;
      }
    }

    const needHelp = await confirm({
      message: "Do you need help finding your Telegram user ID? (opens docs)",
      initialValue: false,
    });
    guardCancel(needHelp);
    if (needHelp) {
      try {
        const cmd =
          process.platform === "darwin"
            ? "open"
            : process.platform === "win32"
              ? "start"
              : "xdg-open";
        const { spawn } = await import("node:child_process");
        spawn(cmd, [HELP_URL], { stdio: "ignore", detached: true }).unref();
      } catch {}
      console.log(`\n  Docs: ${HELP_URL}\n`);
    }

    const answer = await text({
      message: "Enter your Telegram user ID (numeric):",
      placeholder: "123456789",
      validate(value) {
        if (!value || value.trim() === "") return "User ID is required.";
        const n = parseUserId(value);
        if (n === null)
          return `Invalid user ID. Must be a positive integer up to ${TELEGRAM_USER_ID_MAX}.`;
        return undefined;
      },
    });
    guardCancel(answer);

    ctx.results.userId = parseUserId((answer as string).trim()) as number;
  },
};
