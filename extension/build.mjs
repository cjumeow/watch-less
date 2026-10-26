// Builds the extension into dist/, the folder Chrome loads: the content script, the service worker and the popup's script, each bundled
// with @yt-digest/shared, next to the manifest, the page's stylesheet, the popup's page and its icons.

import { copyFileSync, cpSync, rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });

const common = { bundle: true, target: "chrome120", sourcemap: true, logLevel: "warning" };
// A content script is a classic script, so it cannot be an ES module.
await build({ ...common, entryPoints: ["src/content.ts"], format: "iife", outfile: "dist/content.js" });
await build({ ...common, entryPoints: ["src/background.ts"], format: "esm", outfile: "dist/background.js" });
await build({ ...common, entryPoints: ["src/popup.ts"], format: "esm", outfile: "dist/popup.js" });

copyFileSync("manifest.json", "dist/manifest.json");
copyFileSync("src/page.css", "dist/page.css");
copyFileSync("src/popup.html", "dist/popup.html");
copyFileSync("src/popup.css", "dist/popup.css");
cpSync("icons", "dist/icons", { recursive: true });
