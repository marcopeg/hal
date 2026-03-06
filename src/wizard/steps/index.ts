import type { WizardStep } from "../types.js";
import { additionalUsersStep } from "./additional-users.js";
import { botTokenStep } from "./bot-token.js";
import { cwdStep } from "./cwd.js";
import { engineStep } from "./engine.js";
import { projectNameStep } from "./project-name.js";
import { sessionStep } from "./session.js";
import { userIdStep } from "./user-id.js";

// Execution order matters — steps run top to bottom.
const steps: WizardStep[] = [
  projectNameStep,
  cwdStep,
  botTokenStep,
  userIdStep,
  additionalUsersStep,
  engineStep,
  sessionStep,
];

export default steps;
