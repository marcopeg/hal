import { confirm, text } from "@clack/prompts";
import { guardCancel } from "../runner.js";
import type { WizardContext, WizardStep } from "../types.js";

const TELEGRAM_USER_ID_MAX = 0xfffffffff;

function parseUserId(raw: string): number | null {
  const str = raw.trim();
  const num = Number(str);
  if (!Number.isFinite(num) || !Number.isInteger(num)) return null;
  if (num < 1 || num > TELEGRAM_USER_ID_MAX) return null;
  return num;
}

export const additionalUsersStep: WizardStep = {
  id: "additional-users",
  label: "Additional allowed users",

  isConfigured(ctx: WizardContext): boolean {
    // Skip this step in gap-fill mode if at least one user ID is already present
    // (we don't want to nag about adding more users every time).
    // Only prompt in --reset mode or fresh setup.
    const globalIds = ctx.existingConfig?.globals?.access?.allowedUserIds ?? [];
    const projects = ctx.existingConfig?.projects ?? {};
    const projectIds = Object.values(projects).flatMap(
      (p) => p.access?.allowedUserIds ?? [],
    );
    return !ctx.reset && (globalIds.length > 0 || projectIds.length > 0);
  },

  run: async (ctx: WizardContext) => {
    const extra: number[] = [];

    while (true) {
      const addMore = await confirm({
        message:
          extra.length === 0
            ? "Add another allowed user? (other people who can use the bot)"
            : "Add another user?",
        initialValue: false,
      });
      guardCancel(addMore);
      if (!addMore) break;

      const answer = await text({
        message: "Enter their Telegram user ID (numeric):",
        placeholder: "987654321",
        validate(value) {
          if (!value || value.trim() === "") return "User ID is required.";
          const n = parseUserId(value);
          if (n === null)
            return `Invalid user ID. Must be a positive integer up to ${TELEGRAM_USER_ID_MAX}.`;
          return undefined;
        },
      });
      guardCancel(answer);

      const n = parseUserId((answer as string).trim());
      if (n !== null) extra.push(n);
    }

    ctx.results.additionalUserIds = extra;
  },
};
