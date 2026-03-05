import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export const description = "Beep the Mac at full volume to help locate it";

export default async function handler({ args }) {
  // Optional: pass a number of beeps, default 6 (~3 seconds)
  const count = Math.min(Math.max(Number.parseInt(args[0], 10) || 6, 1), 20);

  // Save current output volume
  const { stdout } = await execAsync(
    "osascript -e 'output volume of (get volume settings)'",
  );
  const original = Number.parseInt(stdout.trim(), 10);

  try {
    // Blast to max and beep
    await execAsync("osascript -e 'set volume output volume 100'");
    await execAsync(`osascript -e 'beep ${count}'`);
  } finally {
    // Always restore, even if beep fails
    await execAsync(`osascript -e 'set volume output volume ${original}'`);
  }

  return `📍 Beeped ${count} times at full volume (restored to ${original}%)!`;
}
