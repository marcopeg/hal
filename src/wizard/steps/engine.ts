import { multiselect, select, spinner } from "@clack/prompts";
import type { EngineName } from "../engine-discovery.js";
import { guardCancel } from "../runner.js";
import type { WizardContext, WizardStep } from "../types.js";

const VALID_ENGINES = [
  "claude",
  "copilot",
  "codex",
  "opencode",
  "cursor",
  "antigravity",
] as const;

function enabledEnginesFromProviders(providers: unknown): EngineName[] | null {
  if (!providers || typeof providers !== "object") return null;
  const keys = Object.keys(providers as Record<string, unknown>);
  const enabled = keys.filter((k) =>
    (VALID_ENGINES as readonly string[]).includes(k),
  ) as EngineName[];
  return enabled.length > 0 ? enabled : null;
}

export const engineStep: WizardStep = {
  id: "engine",
  label: "Engines and default",

  isConfigured(ctx: WizardContext): boolean {
    const globalEngine = ctx.existingConfig?.globals?.engine?.name;
    const projects = ctx.existingConfig?.projects ?? {};
    const keys = Object.keys(projects);
    const primaryKey =
      (ctx.results as Record<string, unknown>).projectKey ??
      (keys.length > 0 ? keys[0] : undefined);
    const primaryProject =
      typeof primaryKey === "string" ? projects[primaryKey] : undefined;
    const projectEngine = primaryProject?.engine?.name;
    return !!(globalEngine || projectEngine);
  },

  shouldSkip(ctx: WizardContext): boolean {
    const e = ctx.prefill.engine;
    return (
      typeof e === "string" && (VALID_ENGINES as readonly string[]).includes(e)
    );
  },

  run: async (ctx: WizardContext) => {
    // Prefill: engine flag means "enable only this engine and set it as default".
    if (
      ctx.prefill.engine &&
      (VALID_ENGINES as readonly string[]).includes(ctx.prefill.engine)
    ) {
      const engine = ctx.prefill.engine as EngineName;
      ctx.results.enabledEngines = [engine];
      ctx.results.engine = engine;
      return;
    }

    // Gap-fill: if providers are already configured, do not re-ask which engines
    // to enable — just pick the default engine from the enabled set.
    const fromProviders = enabledEnginesFromProviders(
      ctx.existingConfig?.providers,
    );
    if (fromProviders) {
      ctx.results.enabledEngines = fromProviders;

      let defaultEngine: EngineName;
      if (fromProviders.length === 1) {
        defaultEngine = fromProviders[0];
      } else {
        const picked = await select({
          message: "Which engine should be used by default?",
          options: fromProviders.map((e) => ({ value: e, label: e })),
        });
        guardCancel(picked);
        defaultEngine = picked as EngineName;
      }

      ctx.results.engine = defaultEngine;
      return;
    }

    let availableList: EngineName[] = [];
    if (ctx.availableEnginesPromise) {
      // If discovery hasn't finished yet, show a spinner so it doesn't feel stuck.
      const s = spinner();
      s.start("Investigating which engines are available in your system...");
      try {
        const res = await ctx.availableEnginesPromise;
        availableList = (res as string[]).filter((e) =>
          (VALID_ENGINES as readonly string[]).includes(e),
        ) as EngineName[];
      } finally {
        s.stop("Engine discovery complete");
      }
    }

    const available = new Set<EngineName>(availableList);

    const options = VALID_ENGINES.map((e) => ({
      value: e,
      label: available.has(e) ? e : `${e} (not detected)`,
    }));

    const initial =
      available.size > 0
        ? VALID_ENGINES.filter((e) => available.has(e))
        : (["codex"] as EngineName[]);

    console.log("  Tip: Space to toggle, Enter to confirm.");

    // Enable engines (providers)
    const enabled = await multiselect({
      message: "Which engines do you want to enable on this machine?",
      options,
      initialValues: initial,
      required: true,
    });
    guardCancel(enabled);

    const enabledEngines = enabled as EngineName[];

    // Default engine (only ask when 2+ enabled)
    let defaultEngine: EngineName | undefined;
    if (
      ctx.prefill.engine &&
      VALID_ENGINES.includes(ctx.prefill.engine as EngineName) &&
      enabledEngines.includes(ctx.prefill.engine as EngineName)
    ) {
      defaultEngine = ctx.prefill.engine as EngineName;
      console.log(`  Default engine pre-filled: ${defaultEngine}`);
    } else if (enabledEngines.length >= 2) {
      const answer = await select({
        message: "Which engine should be used by default?",
        options: enabledEngines.map((e) => ({ value: e, label: e })),
      });
      guardCancel(answer);
      defaultEngine = answer as EngineName;
    } else {
      defaultEngine = enabledEngines[0];
    }

    ctx.results.enabledEngines = enabledEngines;
    ctx.results.engine = defaultEngine;
  },
};
