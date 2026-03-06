import { select, spinner, text } from "@clack/prompts";
import {
  getCursorModelsFromCli,
  getOpencodeModelsFromCli,
} from "../../engine/opencode-models.js";
import { defaultEngineCommand, type EngineName } from "../engine-discovery.js";
import { guardCancel } from "../runner.js";
import type { WizardContext, WizardStep } from "../types.js";

export const modelStep: WizardStep = {
  id: "model",
  label: "Default model",

  isConfigured(ctx: WizardContext): boolean {
    const engine = (ctx.results.engine ??
      ctx.existingConfig?.globals?.engine?.name) as EngineName | undefined;

    // If the engine doesn't require / doesn't support an explicit model in the wizard,
    // treat this step as configured (unless user explicitly provided --model).
    if (
      (engine === "codex" || engine === "copilot") &&
      !(
        typeof ctx.prefill.model === "string" && ctx.prefill.model.trim() !== ""
      )
    ) {
      return true;
    }

    const globalModel = ctx.existingConfig?.globals?.engine?.model;
    return typeof globalModel === "string" && globalModel.trim() !== "";
  },

  shouldSkip(ctx: WizardContext): boolean {
    const engine = (ctx.results.engine ??
      ctx.existingConfig?.globals?.engine?.name) as EngineName | undefined;

    // Codex/Copilot: skip model question unless explicitly prefilled.
    if (engine === "codex" || engine === "copilot") {
      return !(
        typeof ctx.prefill.model === "string" && ctx.prefill.model.trim() !== ""
      );
    }

    return (
      typeof ctx.prefill.model === "string" && ctx.prefill.model.trim() !== ""
    );
  },

  run: async (ctx: WizardContext) => {
    const engine = (ctx.results.engine ??
      ctx.existingConfig?.globals?.engine?.name) as EngineName | undefined;

    if (!engine) {
      // Engine not chosen (or configured) yet; leave model unset.
      ctx.results.model = undefined;
      return;
    }

    // Codex/Copilot: no meaningful model choice in the wizard unless explicitly provided.
    if (engine === "codex" || engine === "copilot") {
      if (ctx.prefill.model && ctx.prefill.model.trim() !== "") {
        ctx.results.model = ctx.prefill.model.trim();
      } else {
        ctx.results.model = undefined;
      }
      return;
    }

    // Prefill: apply silently (no validation here; engine adapters may accept arbitrary strings)
    if (ctx.prefill.model && ctx.prefill.model.trim() !== "") {
      ctx.results.model = ctx.prefill.model.trim();
      return;
    }

    // Cursor/OpenCode: offer discovered model list
    if (engine === "cursor" || engine === "opencode") {
      const s = spinner();
      s.start("Fetching available models...");
      const cmd = defaultEngineCommand(engine);
      const models =
        engine === "cursor"
          ? getCursorModelsFromCli(ctx.cwd, cmd)
          : getOpencodeModelsFromCli(ctx.cwd, cmd);
      s.stop(models.length > 0 ? "Models loaded" : "No models discovered");

      if (models.length > 0) {
        const picked = await select({
          message: "Which model should be used by default? (optional)",
          options: [
            { value: "", label: "engine defaults (recommended)" },
            ...models.map((m) => ({ value: m.name, label: m.name })),
          ],
        });
        guardCancel(picked);
        const v = picked as string;
        ctx.results.model = v === "" ? undefined : v;
        return;
      }

      // No models discovered: keep unset and let engine decide
      ctx.results.model = undefined;
      return;
    }

    // Other engines: accept free-form model name, or empty to use engine defaults
    const answer = await text({
      message: "Default model (optional — press Enter to use engine defaults):",
      placeholder: "engine defaults",
    });
    guardCancel(answer);

    const v = typeof answer === "string" ? answer.trim() : "";
    ctx.results.model = v === "" ? undefined : v;
  },
};
