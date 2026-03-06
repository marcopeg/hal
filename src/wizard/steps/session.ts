import { select } from "@clack/prompts";
import { guardCancel } from "../runner.js";
import type { SessionMode, WizardContext, WizardStep } from "../types.js";

function parseSessionMode(raw: string): SessionMode | null {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "shared") return "shared";
  if (raw === "user") return "user";
  return null;
}

export const sessionStep: WizardStep = {
  id: "session",
  label: "Session behavior",

  isConfigured(ctx: WizardContext): boolean {
    // Session does not block boot: default behavior is used when unset.
    // Only prompt when explicitly resetting.
    if (!ctx.reset) return true;
    const globalSession = ctx.existingConfig?.globals?.engine?.session;
    const projects = ctx.existingConfig?.projects ?? {};
    const projectSession = Object.values(projects).some(
      (p) => p.engine?.session !== undefined,
    );
    return globalSession !== undefined || projectSession;
  },

  shouldSkip(ctx: WizardContext): boolean {
    if (!ctx.prefill.session) return false;
    return parseSessionMode(ctx.prefill.session) !== null;
  },

  run: async (ctx: WizardContext) => {
    // Pre-fill: apply silently
    if (ctx.prefill.session) {
      const mode = parseSessionMode(ctx.prefill.session);
      if (mode !== null) {
        ctx.results.session = mode;
        return;
      }
    }

    const engine = ctx.results.engine ?? "";

    // Single clear session picker with only supported options
    const options: Array<{ value: string; label: string }> = [
      {
        value: "default",
        label: "default — engine default session mechanism",
      },
      {
        value: "disabled",
        label: "disabled — each message is anonymous (no resume/continue)",
      },
    ];

    if (engine === "claude") {
      options.push({
        value: "shared",
        label: "shared — all users share the same session (--continue)",
      });
    }
    if (engine === "codex" || engine === "cursor") {
      options.push({
        value: "user",
        label: "user — each user has their own session (engine-supported)",
      });
    }

    const picked = await select({
      message: "How should the session work?",
      options,
    });
    guardCancel(picked);

    const v = picked as string;
    if (v === "disabled") ctx.results.session = false;
    else if (v === "shared") ctx.results.session = "shared";
    else if (v === "user") ctx.results.session = "user";
    else ctx.results.session = true;
  },
};
