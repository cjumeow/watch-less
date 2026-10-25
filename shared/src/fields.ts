// The checks the parsers of the request and the queue file share.

/** The typed value, or why the input was refused. */
export type Parsed<T> = { parsed: true; value: T } | { parsed: false; reason: string };

/**
 * The fields of an object that may hold only `names`. Every shape here is written by one of our own programs from the
 * same checkout, so a field nobody knows means the programs disagree, and it is refused rather than dropped.
 */
export function readFields<Name extends string>(input: unknown, names: readonly Name[]): Parsed<Record<Name, unknown>> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { parsed: false, reason: "not an object" };
  }
  const unknownName = Object.keys(input).find((name) => !(names as readonly string[]).includes(name));
  if (unknownName !== undefined) {
    return { parsed: false, reason: `unknown field ${unknownName}` };
  }
  // Only the object's own fields, so one it merely inherits reads as missing.
  const fields = Object.fromEntries(
    names.map((name) => [name, Object.hasOwn(input, name) ? (input as Record<Name, unknown>)[name] : undefined]),
  );
  return { parsed: true, value: fields as Record<Name, unknown> };
}

// A video ID becomes a file name in the queue folder, so nothing outside this set gets through.
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export const VIDEO_ID_RULE = "videoId is not 11 characters of A-Z, a-z, 0-9, _ or -";

export function isVideoId(value: unknown): value is string {
  return typeof value === "string" && VIDEO_ID.test(value);
}

// The title is only shown in the notification and the digest's header, and the extension scrapes it from YouTube's
// card markup, so an empty one is accepted: a markup change must not make every request fail.
const TITLE_MAX_LENGTH = 500;
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export const TITLE_RULE = `title is not a string of at most ${String(TITLE_MAX_LENGTH)} characters`;

export function isTitle(value: unknown): value is string {
  // Counted as a reader sees characters, not in UTF-16 units, so an emoji is one character as the reason says. A
  // string no longer than the limit in UTF-16 units is never longer in characters, so it skips the segmenting.
  if (typeof value !== "string") return false;
  return value.length <= TITLE_MAX_LENGTH || [...GRAPHEMES.segment(value)].length <= TITLE_MAX_LENGTH;
}
