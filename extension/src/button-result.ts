import { BUTTON_MESSAGES, parseReply, type ButtonMessage } from "@yt-digest/shared";

/** What the toast shows after the item is chosen: the check, or one of `BUTTON_MESSAGES`. */
export type ButtonResult = { ok: true } | { ok: false; message: ButtonMessage };

/**
 * How sending one request to the native host ended: the host's reply, the error Chrome gave instead, or no answer
 * within the time the extension waits.
 */
export type NativeOutcome = { replied: unknown } | { failed: string } | "timedOut";

// The text of chrome.runtime.lastError when no host of that name is installed for this browser.
const HOST_NOT_FOUND = "Specified native messaging host not found.";

/** The spec's three messages cover three cases; every other way a request can go wrong reads as `failed`. */
export function buttonResult(outcome: NativeOutcome): ButtonResult {
  if (outcome === "timedOut") return { ok: false, message: BUTTON_MESSAGES.noResponse };
  if ("failed" in outcome) {
    return {
      ok: false,
      message: outcome.failed === HOST_NOT_FOUND ? BUTTON_MESSAGES.notInstalled : BUTTON_MESSAGES.failed,
    };
  }
  const reply = parseReply(outcome.replied);
  if (reply.parsed && reply.value.ok) return { ok: true };
  return { ok: false, message: BUTTON_MESSAGES.failed };
}
