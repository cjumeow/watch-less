// The transcript step's entry point, which the worker's main module imports. Until the step is built, it fails every
// digest with a reason that says so.

import { DigestFailure } from "../digest-failure.js";
import type { TranscriptStep } from "./transcript-step.js";

export type * from "./transcript-step.js";

export function createTranscriptStep(): TranscriptStep {
  return {
    checkVideo: () => Promise.reject(new DigestFailure("The transcript step is not built yet")),
  };
}
