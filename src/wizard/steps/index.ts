import type { WizardStep } from "../types.js";
import { additionalUsersStep } from "./additional-users.js";
import { botTokenStep } from "./bot-token.js";
import { cwdStep } from "./cwd.js";
import { engineStep } from "./engine.js";
import { projectNameStep } from "./project-name.js";
import { sessionStep } from "./session.js";
import { userIdStep } from "./user-id.js";

// Execution order matters — steps run top to bottom.
export const globalSteps: WizardStep[] = [
  userIdStep,
  additionalUsersStep,
  engineStep,
  sessionStep,
];

export const projectSteps: WizardStep[] = [cwdStep, botTokenStep];

export const bootstrapSteps: WizardStep[] = [projectNameStep];
