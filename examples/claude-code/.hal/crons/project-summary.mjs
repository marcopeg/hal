// Project-tier programmatic cron example.
//
// Fires every Friday at 17:00 and sends a weekly git activity summary
// to a specific Telegram user.
//
// ctx.project  — full resolved project config
// ctx.bot      — Grammy Bot for this project
// ctx.context  — resolved context vars (same map as .md prompt injection)
// ctx.call()   — call this project's AI engine

export const enabled = false;
export const schedule = "0 17 * * 5"; // every Friday at 17:00

/**
 * @param {import('@marcopeg/hal').ProjectCronContext} ctx
 */
export async function handler(ctx) {
  const projectName =
    ctx.context["project.name"] ?? ctx.project.name ?? ctx.project.slug;

  const summary = await ctx.call(
    "Summarise this week's git activity: commits, authors, and the most significant changes. Keep it under 15 lines.",
  );

  await ctx.bot.api.sendMessage(
    123456,
    `📋 Weekly summary for *${projectName}*:\n\n${summary}`,
    { parse_mode: "Markdown" },
  );
}
