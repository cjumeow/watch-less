/**
 * A digest that cannot be made, thrown by a step. Its `reason` is the text of the `Digest failed` notification, so it
 * is short English the developer reads, such as `No transcript available`; the details go in `cause`, which the
 * worker writes to its log.
 */
export class DigestFailure extends Error {
  constructor(
    readonly reason: string,
    options?: ErrorOptions,
  ) {
    super(reason, options);
    this.name = "DigestFailure";
  }
}
