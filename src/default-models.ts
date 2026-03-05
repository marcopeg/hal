import type { EngineName } from "./engine/types.js";

/**
 * HAL-defined default models for engines that require an explicit model
 * when `engine.model` is omitted from config.
 *
 * Engines NOT listed here (Codex, Copilot, Cursor, OpenCode) use their own
 * built-in default when no model is passed; HAL does not add -m / --model.
 */
const DEFAULT_ENGINE_MODEL: Partial<Record<EngineName, string>> = {
  claude: "default",
  // TODO: Antigravity — add entry here once the engine adapter is implemented.
};

export function getDefaultEngineModel(engine: EngineName): string | undefined {
  return DEFAULT_ENGINE_MODEL[engine];
}
