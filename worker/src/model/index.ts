// The model step's entry point, which the worker's main module imports. Until the step is built, it fails every
// digest with a reason that says so.

import { DigestFailure } from "../digest-failure.js";
import type { ModelStep } from "./model-step.js";

export type * from "./model-step.js";

export function createModelStep(): ModelStep {
  return {
    writeDigest: () => Promise.reject(new DigestFailure("The model step is not built yet")),
  };
}
