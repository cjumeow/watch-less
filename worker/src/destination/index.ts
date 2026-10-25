// The destination's entry point, which the worker's main module imports. Until Heptabase is built, it fails every
// digest with a reason that says so.

import { DigestFailure } from "../digest-failure.js";
import type { Destination } from "./destination.js";

export type * from "./destination.js";

export function createDestination(): Destination {
  return {
    deliver: () => Promise.reject(new DigestFailure("The destination is not built yet")),
  };
}
