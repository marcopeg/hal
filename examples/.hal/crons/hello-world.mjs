export const name = "hello-world";
export const schedule = "* * * * *"; // every minute

export async function handler(ctx) {
  console.log("CRON Hello World");
  await ctx.projects["claude-code"].bot.api.sendMessage(7974709349, "CRON Hello World");
}
