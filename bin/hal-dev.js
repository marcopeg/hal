#!/usr/bin/env node

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, "..");
const isWin = process.platform === "win32";
const tsxBin = join(repoRoot, "node_modules", ".bin", isWin ? "tsx.cmd" : "tsx");
const cliTsPath = join(repoRoot, "src", "cli.ts");

if (!existsSync(tsxBin)) {
  console.error(
    "hal-dev: missing tsx binary. Run `npm install` in the HAL repository first.",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const watch = args[0] === "--watch";
const forwarded = watch ? args.slice(1) : args;
const tsxArgs = watch
  ? ["watch", cliTsPath, ...forwarded]
  : [cliTsPath, ...forwarded];

const child = spawn(tsxBin, tsxArgs, {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

