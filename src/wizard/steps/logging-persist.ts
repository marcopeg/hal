import { select } from "@clack/prompts";
import { guardCancel } from "../runner.js";
import type { WizardContext, WizardStep } from "../types.js";

export const loggingPersistStep: WizardStep = {
  id: "logging-persist",
  label: "Log persistence",

  isConfigured(ctx: WizardContext): boolean {
    const persist = ctx.existingConfig?.globals?.logging?.persist;
    return typeof persist === "boolean";
  },

  run: async (ctx: WizardContext) => {
    const existing = ctx.existingConfig?.globals?.logging?.persist;
    const initialValue = typeof existing === "boolean" ? existing : false;

    const answer = await select({
      message: "Do you want to persist logs under .hal/logs?",
      options: [
        {
          value: true,
          label: "Yes - keep logs on disk in .hal/logs",
        },
        {
          value: false,
          label: "No - terminal logs only (default)",
        },
      ],
      initialValue,
    });
    guardCancel(answer);

    ctx.results.loggingPersist = answer as boolean;
  },
};
