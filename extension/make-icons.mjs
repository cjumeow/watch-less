// Draws icons/icon-<size>.png from icons/icon.svg, Tabler's message-ai (MIT, https://tabler.io/icons), with Playwright's
// own Chromium. Run `node extension/make-icons.mjs` from the repository root when the icon changes and commit the PNGs:
// the build copies them and needs no browser.

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const SIZES = [16, 32, 48, 128];
const svg = readFileSync(new URL("icons/icon.svg", import.meta.url), "utf8");

const browser = await chromium.launch();
for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({
    path: new URL(`icons/icon-${size}.png`, import.meta.url).pathname,
    omitBackground: true,
  });
  await page.close();
}
await browser.close();
