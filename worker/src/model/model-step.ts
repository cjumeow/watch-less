// The interface of the worker's model step: `claude -p` writes the digest's sections from the transcript.

import type { Transcript } from "../transcript/transcript-step.js";

/** What the model is given; the step turns it into the stdin `prompt/README.md` describes. */
export interface DigestInput {
  videoId: string;
  title: string;
  /** The video's description, links included; empty when it has none. */
  description: string;
  transcript: Transcript;
}

export type ModelAnswer =
  /** The digest's four sections, each heading checked, and the name of the model that wrote them for the header. */
  | { outcome: "written"; sections: string; model: string }
  /** The subscription's usage limit was reached: the request stays queued and runs on a later start of the worker. */
  | { outcome: "postponed" };

export interface ModelStep {
  /** Throws a `DigestFailure` for any other error, such as `The digest was incomplete`. */
  writeDigest(input: DigestInput): Promise<ModelAnswer>;
}
