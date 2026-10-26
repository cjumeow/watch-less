// The service worker: a content script cannot reach the native host, so the menu item's request comes here and goes on
// with chrome.runtime.sendNativeMessage. Only this extension's own content scripts can send it a message: the manifest
// has no externally_connectable, so no web page can.

import { BUTTON_MESSAGES, parseRequest, type RequestMessage } from "@yt-digest/shared";
import { savedSettings, STORAGE_KEYS } from "./saved-settings.js";
import { buttonResult, type ButtonResult, type NativeOutcome } from "./button-result.js";

/** The native host's name, which its manifest declares. */
const HOST = "com.yt_digest.host";

/** How long the extension waits for the host's reply before its toast says it did not respond. */
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
  // The popup's choices at this moment, so that the next request uses what was chosen last.
  const settings = savedSettings(await chrome.storage.local.get([...STORAGE_KEYS]).catch(() => ({})));
  return buttonResult(await send({ videoId: request.value.videoId, title: request.value.title, ...settings }));
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (result: ButtonResult) => void) => {
  void handle(message).then(sendResponse);
  // Keeps the channel open until sendResponse is called.
  return true;
});
