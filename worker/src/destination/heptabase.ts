import type { Digest } from "./destination.js";

export function toHeptabaseMarkdown(digest: Digest): string {
  return digest.markdown.replace(`\n${digest.videoLink}\n`, `\n{{youtube ${digest.videoLink}}}\n`);
}
