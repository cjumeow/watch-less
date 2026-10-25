/** The text the button shows next to its icon for 3 seconds when a request was not put in the queue. */
export const BUTTON_MESSAGES = {
  /** Chrome found no native host to send the request to. */
  notInstalled: "yt-digest is not installed",
  /** The native host did not reply within 5 seconds. */
  noResponse: "yt-digest did not respond",
  /** The native host replied with an error. */
  failed: "yt-digest failed",
} as const;

export type ButtonMessage = (typeof BUTTON_MESSAGES)[keyof typeof BUTTON_MESSAGES];
