import { basename } from "node:path";
import { text } from "@clack/prompts";
import { guardCancel } from "../runner.js";
import type { WizardContext, WizardStep } from "../types.js";

export const projectNameStep: WizardStep = {
  id: "project-name",
  label: "Project name",

  isConfigured(ctx: WizardContext): boolean {
    if (ctx.reset) return false;
    const key = ctx.currentProjectKey ?? ctx.results.projectKey;
    if (!key) return false;
    const edited = ctx.results.projectEdits?.[key]?.name;
    if (typeof edited === "string" && edited.trim() !== "") return true;
    const existing = ctx.existingConfig?.projects?.[key]?.name;
    return typeof existing === "string" && existing.trim() !== "";
  },

  shouldSkip(ctx: WizardContext): boolean {
    const oneProject = (ctx.targetProjectKeys?.length ?? 1) <= 1;
    return (
      oneProject &&
      typeof ctx.prefill.name === "string" &&
      ctx.prefill.name.trim() !== ""
    );
  },

  run: async (ctx: WizardContext) => {
    const key = ctx.currentProjectKey ?? ctx.results.projectKey ?? "prj1";
    if (!ctx.results.projectEdits) ctx.results.projectEdits = {};
    ctx.results.projectEdits[key] ??= {};

    // Pre-fill: apply silently (single-project only)
    if ((ctx.targetProjectKeys?.length ?? 1) <= 1 && ctx.prefill.name) {
      const pre = ctx.prefill.name.trim();
      if (pre) {
        ctx.results.projectEdits[key].name = pre;
        ctx.results.projectName = pre;
        return;
      }
    }

    const cwd =
      ctx.results.projectEdits?.[key]?.cwd ??
      ctx.existingConfig?.projects?.[key]?.cwd ??
      ".";
    const defaultName =
      cwd === "." || cwd === "./"
        ? basename(ctx.cwd)
        : basename(
            String(cwd)
              .replace(/\/+$/g, "")
              .replace(/^\.\/+/, ""),
          );

    const answer = await text({
      message: `Project name (default: ${defaultName}):`,
      placeholder: defaultName,
    });
    guardCancel(answer);

    const name = typeof answer === "string" ? answer.trim() : "";
    ctx.results.projectEdits[key].name = name === "" ? defaultName : name;
    if (key === ctx.results.projectKey) {
      ctx.results.projectName = ctx.results.projectEdits[key].name;
    }
  },
};
