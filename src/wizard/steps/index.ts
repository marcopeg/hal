import type { WizardStep } from "../types.js";
import { botTokenStep } from "./bot-token.js";
import { cwdStep } from "./cwd.js";
import { engineStep } from "./engine.js";
import { modelStep } from "./model.js";
import { projectNameStep } from "./project-name.js";
import { userIdStep } from "./user-id.js";

// Execution order matters — steps run top to bottom.
export const globalSteps: WizardStep[] = [engineStep, modelStep];

export const projectSteps: WizardStep[] = [
  cwdStep,
  projectNameStep,
  botTokenStep,
];

export const finalSteps: WizardStep[] = [userIdStep];
