// Builds the extension into dist/, the folder Chrome loads: the content script and the service worker, each bundled
// with @yt-digest/shared, next to the manifest and the page's stylesheet.

import { copyFileSync, rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });

const common = { bundle: true, target: "chrome120", sourcemap: true, logLevel: "warning" };
// A content script is a classic script, so it cannot be an ES module.
await build({ ...common, entryPoints: ["src/content.ts"], format: "iife", outfile: "dist/content.js" });
await build({ ...common, entryPoints: ["src/background.ts"], format: "esm", outfile: "dist/background.js" });

copyFileSync("manifest.json", "dist/manifest.json");
copyFileSync("src/page.css", "dist/page.css");
