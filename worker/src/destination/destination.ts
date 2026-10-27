// The interface of a destination, where a finished digest is delivered. Heptabase is the first, Notion the second; the queue file says which one a digest goes to.

import type { DestinationId } from "@yt-digest/shared";

/** A finished digest: the worker's header, then the model's sections. */
export interface Digest {
  /** Where to deliver it: the request's choice, or Heptabase when it made none. */
  destination: DestinationId;
  /** The Notion page the digest becomes a page inside; none means the Private section. Used only for Notion. */
  notionFolderPage?: string;
  /** `https://www.youtube.com/watch?v=<id>`, which is also the header's line of its own. */
  videoLink: string;
  /** Starts with `# <title>`. */
  markdown: string;
}

/** Where a delivered digest can be opened, for the notification: absent when the destination gave none. */
export interface Delivered {
  link?: string;
}

export interface Destination {
  /** Resolves once the digest is delivered; throws a `DigestFailure` with the reason when it cannot be. */
  deliver(digest: Digest): Promise<Delivered>;
}
