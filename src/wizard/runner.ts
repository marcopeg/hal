import { isCancel, outro } from "@clack/prompts";
import type { WizardContext, WizardStep } from "./types.js";

/**
 * Iterates through the step registry. For each step:
 * - Skips if isConfigured() returns true AND --reset is false.
 * - Skips if shouldSkip() returns true.
 * - Shows progress ("Step N of M").
 * - Calls run().
 * - Handles Ctrl+C (isCancel) at any point via a thrown symbol that prompts catch.
 */
export async function runWizard(
  ctx: WizardContext,
  steps: WizardStep[],
): Promise<void> {
  const active = steps.filter((s) => {
    if (s.shouldSkip?.(ctx)) return false;
    if (!ctx.reset && s.isConfigured(ctx)) return false;
    return true;
  });

  if (active.length === 0) {
    return;
  }

  for (let i = 0; i < active.length; i++) {
    const step = active[i];
    process.stdout.write(`\n[Step ${i + 1}/${active.length}] ${step.label}\n`);
    await step.run(ctx);
  }
}

/**
 * Call after any @clack/prompts prompt returns a value to check for cancellation.
 * Exits the process cleanly if the user pressed Ctrl+C.
 */
export function guardCancel(value: unknown): void {
  if (isCancel(value)) {
    outro("Setup cancelled. No files were written.");
    process.exit(0);
  }
}
