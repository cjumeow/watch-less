// Playwright fixtures for the end-to-end tests: Playwright's own Chromium with the built extension loaded, in a
// temporary profile that is removed afterwards, offline except for the made-up pages in e2e/pages/, and a fake native
// host installed in that profile. Never the developer's Chrome, profile or installed native host.

import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { type BrowserContext, chromium, test as base, type Page } from "@playwright/test";

const EXTENSION_DIR = fileURLToPath(new URL("../extension/dist", import.meta.url));
const PAGES_DIR = fileURLToPath(new URL("pages", import.meta.url));
const FAKE_HOST = fileURLToPath(new URL("fake-native-host.mjs", import.meta.url));

/** The extension's ID, from the fixed key in its manifest. */
export const EXTENSION_ID = "cfblilbnkpdfadellmkpijlbmacfeico";
const HOST_NAME = "com.yt_digest.host";

/** The made-up pages, by the path and query YouTube serves each one at. */
const ROUTES: Record<string, string> = {
  "/": "home.html",
  "/results?search_query=example": "search.html",
  "/playlist?list=WL": "watch-later.html",
  // Another playlist, with the same markup as Watch Later, where no button belongs.
  "/playlist?list=PLexampleList": "watch-later.html",
  "/e2e-pages/youtube.css": "youtube.css",
  "/e2e-pages/preview.js": "preview.js",
};

/** What the fake native host answers: a reply, or nothing at all. */
export type HostAnswer = { reply: unknown } | "silent";

export interface FakeHost {
  /** Sets what the host answers the next requests with. */
  answer(answer: HostAnswer): Promise<void>;
  /** The messages the host received, in order. */
  requests(): Promise<unknown[]>;
}

export const test = base.extend<{
  hostInstalled: boolean;
  hostDir: string;
  host: FakeHost;
  context: BrowserContext;
  page: Page;
}>({
  /** Whether the profile has the fake host's manifest; `test.use({ hostInstalled: false })` takes it away. */
  hostInstalled: [true, { option: true }],

  /** The fake host's folder, FAKE_HOST_DIR: what it should answer and what it received. */
  // eslint-disable-next-line no-empty-pattern -- Playwright reads a fixture's dependencies from this pattern.
  hostDir: async ({}, use) => {
    const dir = await mkdtemp(join(tmpdir(), "yt-digest-e2e-host-"));
    try {
      await use(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },

  host: async ({ hostDir }, use) => {
    await use({
      async answer(answer) {
        await writeFile(join(hostDir, "reply.json"), answer === "silent" ? "silent" : JSON.stringify(answer.reply));
      },
      async requests() {
        const text = await readFile(join(hostDir, "requests.jsonl"), "utf8").catch(() => "");
        return text
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as unknown);
      },
    });
  },

  context: async ({ hostInstalled, hostDir }, use) => {
    const profileDir = await mkdtemp(join(tmpdir(), "yt-digest-e2e-profile-"));
    if (hostInstalled) await installFakeHost(profileDir, hostDir);
    const context = await chromium.launchPersistentContext(profileDir, {
      // The full Chromium in its new headless mode, which loads extensions; the headless shell does not.
      channel: "chromium",
      args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
      env: { ...process.env, FAKE_HOST_DIR: hostDir },
      viewport: { width: 1100, height: 800 },
    });
    try {
      // Offline: the made-up pages are served for YouTube's URLs, and every other request fails.
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        const file = url.hostname === "www.youtube.com" ? ROUTES[url.pathname + url.search] : undefined;
        if (file === undefined) {
          await route.abort("blockedbyclient");
          return;
        }
        await route.fulfill({ path: join(PAGES_DIR, file) });
      });
      await use(context);
    } finally {
      await context.close();
      await rm(profileDir, { recursive: true, force: true });
    }
  },

  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? (await context.newPage()));
  },
});

/**
 * Installs the fake host for this profile only: Chromium also looks for native host manifests in the profile's own
 * NativeMessagingHosts folder, so the developer's installed host is never the one a test reaches.
 */
async function installFakeHost(profileDir: string, hostDir: string) {
  // Chromium starts the host's path with no arguments it controls, so a small script starts Node on the fake host.
  const launcher = join(hostDir, "fake-native-host.sh");
  await writeFile(launcher, `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(FAKE_HOST)} "$@"\n`);
  await chmod(launcher, 0o755);
  const manifestDir = join(profileDir, "NativeMessagingHosts");
  await mkdir(manifestDir);
  await writeFile(
    join(manifestDir, `${HOST_NAME}.json`),
    JSON.stringify({
      name: HOST_NAME,
      description: "A fake yt-digest native host for the end-to-end tests",
      path: launcher,
      type: "stdio",
      allowed_origins: [`chrome-extension://${EXTENSION_ID}/`],
    }),
  );
}

/** A path as one shell word, whatever characters it has. */
function shellQuote(path: string): string {
  return `'${path.replaceAll("'", `'\\''`)}'`;
}

/** What the button on one card shows, read from inside its closed shadow root. */
export interface ButtonState {
  label: string | null;
  /** True while the request is waiting for the host. */
  disabled: boolean;
  icon: "note" | "check";
  /** The message next to the icon, or null when none shows. */
  message: string | null;
  messageRole: string | null;
}

/**
 * The state of every button on the page, in document order. The button's shadow root is closed, so a page script,
 * and Playwright's own selectors, cannot see inside it; the DevTools protocol can, as it lists closed shadow roots.
 */
export async function buttonStates(page: Page): Promise<ButtonState[]> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { root } = (await cdp.send("DOM.getDocument", { depth: -1, pierce: true })) as { root: DomNode };
    const states: ButtonState[] = [];
    for (const host of findNodes(root, "YT-DIGEST-BUTTON")) {
      const shadowRoot = host.shadowRoots?.[0];
      if (shadowRoot === undefined) throw new Error("A button has no shadow root");
      const { object } = await cdp.send("DOM.resolveNode", { backendNodeId: shadowRoot.backendNodeId });
      const { result } = await cdp.send("Runtime.callFunctionOn", {
        objectId: object.objectId,
        functionDeclaration: readButton.toString(),
        returnByValue: true,
      });
      states.push(result.value as ButtonState);
    }
    return states;
  } finally {
    await cdp.detach();
  }
}

// Runs in the page, on one button's shadow root.
function readButton(this: ShadowRoot): ButtonState {
  const button = this.querySelector("button");
  const message = this.querySelector<HTMLElement>("[role]");
  // The check is the icon whose path starts with the tick's first point; the note is the other one.
  const path = button?.querySelector("path")?.getAttribute("d") ?? "";
  const text = message?.textContent ?? "";
  return {
    label: button?.getAttribute("aria-label") ?? null,
    disabled: button?.getAttribute("aria-disabled") === "true",
    icon: path.startsWith("m5 12.5") ? "check" : "note",
    message: text === "" ? null : text,
    messageRole: message?.getAttribute("role") ?? null,
  };
}

interface DomNode {
  nodeName: string;
  backendNodeId: number;
  children?: DomNode[];
  shadowRoots?: DomNode[];
}

function findNodes(node: DomNode, name: string): DomNode[] {
  const found = node.nodeName === name ? [node] : [];
  for (const child of [...(node.shadowRoots ?? []), ...(node.children ?? [])]) found.push(...findNodes(child, name));
  return found;
}

export { expect } from "@playwright/test";
