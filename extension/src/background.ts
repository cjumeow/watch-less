// The service worker: a content script cannot reach the native host, so the button's request comes here and goes on
// with chrome.runtime.sendNativeMessage. Only this extension's own content scripts can send it a message: the manifest
// has no externally_connectable, so no web page can.

import { BUTTON_MESSAGES, parseRequest, type RequestMessage } from "@yt-digest/shared";
import { buttonResult, type ButtonResult, type NativeOutcome } from "./button-result.js";

/** The native host's name, which its manifest declares. */
const HOST = "com.yt_digest.host";

/** How long the button waits for the host's reply. */
const TIMEOUT_MS = 5000;

async function send(request: RequestMessage): Promise<NativeOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<NativeOutcome>((resolve) => {
    timer = setTimeout(() => {
      resolve("timedOut");
    }, TIMEOUT_MS);
  });
  const replied = chrome.runtime.sendNativeMessage(HOST, request).then(
    (reply: unknown): NativeOutcome => ({ replied: reply }),
    (error: unknown): NativeOutcome => ({ failed: error instanceof Error ? error.message : String(error) }),
  );
  try {
    return await Promise.race([replied, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

async function handle(message: unknown): Promise<ButtonResult> {
  const request = parseRequest(message);
  if (!request.parsed) return { ok: false, message: BUTTON_MESSAGES.failed };
  return buttonResult(await send(request.value));
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (result: ButtonResult) => void) => {
  void handle(message).then(sendResponse);
  // Keeps the channel open until sendResponse is called.
  return true;
});
