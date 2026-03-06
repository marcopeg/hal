import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { select } from "@clack/prompts";
import { guardCancel } from "../runner.js";
import type { WizardContext, WizardStep } from "../types.js";

const PLACEHOLDER_RE = /^\$\{[^}]+\}$/;

function isPlaceholder(value: unknown): boolean {
  return typeof value === "string" && PLACEHOLDER_RE.test(value.trim());
}

function listSubdirs(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((entry) => {
        if (entry.startsWith(".")) return false;
        try {
          return statSync(join(dir, entry)).isDirectory();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

export const cwdStep: WizardStep = {
  id: "cwd",
  label: "Project working directory",

  isConfigured(ctx: WizardContext): boolean {
    const projects = ctx.existingConfig?.projects ?? {};
    const key = ctx.currentProjectKey ?? ctx.results.projectKey;
    if (key && projects[key]) {
      const p = projects[key];
      return !!(p.cwd && !isPlaceholder(p.cwd) && p.cwd !== "");
    }
    return Object.values(projects).some(
      (p) => p.cwd && !isPlaceholder(p.cwd) && p.cwd !== "",
    );
  },

  shouldSkip(ctx: WizardContext): boolean {
    const oneProject = (ctx.targetProjectKeys?.length ?? 1) <= 1;
    return (
      oneProject &&
      typeof ctx.prefill.cwd === "string" &&
      ctx.prefill.cwd.trim() !== ""
    );
  },

  run: async (ctx: WizardContext) => {
    const key = ctx.currentProjectKey ?? ctx.results.projectKey;
    if (!ctx.results.projectEdits) ctx.results.projectEdits = {};
    const edits = ctx.results.projectEdits;
    if (key) edits[key] ??= {};

    // Pre-fill: apply silently
    if (
      (ctx.targetProjectKeys?.length ?? 1) <= 1 &&
      ctx.prefill.cwd &&
      ctx.prefill.cwd.trim() !== ""
    ) {
      const v = ctx.prefill.cwd.trim();
      if (key) edits[key].cwd = v;
      ctx.results.cwd = v;
      return;
    }

    const subdirs = listSubdirs(ctx.cwd);
    const absRoot = resolve(ctx.cwd);
    const options: { value: string; label: string }[] = [
      { value: ".", label: `. (current directory — ${absRoot})` },
      ...subdirs.map((d) => ({ value: `./${d}`, label: d })),
    ];

    const answer = await select({
      message: "Which directory should the project run in?",
      options,
    });
    guardCancel(answer);

    const v = answer as string;
    if (key) edits[key].cwd = v;
    ctx.results.cwd = v;
  },
};
