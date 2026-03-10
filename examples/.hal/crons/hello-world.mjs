export const enabled = false;
export const schedule = "*/10 * * * * *"; // every 10 seconds

export async function handler(ctx) {
  console.log("CRON Hello World");
  await ctx.projects["claude-code"].bot.api.sendMessage(7974709349, "CRON Hello World");
}
