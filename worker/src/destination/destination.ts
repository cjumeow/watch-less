// The interface of a destination, where a finished digest is delivered. Heptabase is the first.

/** A finished digest: the worker's header, then the model's sections. */
export interface Digest {
  /** `https://www.youtube.com/watch?v=<id>`, which is also the header's line of its own. */
  videoLink: string;
  /** Starts with `# <title>`. */
  markdown: string;
}

export interface Destination {
  /** Resolves once the digest is delivered; throws a `DigestFailure` with the reason when it cannot be. */
  deliver(digest: Digest): Promise<void>;
}
