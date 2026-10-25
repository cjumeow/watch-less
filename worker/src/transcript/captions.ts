import type { TranscriptLine } from "./transcript-step.js";

/** Reads the VTT format requested from yt-dlp. */
export function parseCaptions(vtt: string, rolling = false): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  let previous: { start: number; end: number; rows: string[] } | undefined;
  for (const block of vtt.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const rows = block.split("\n");
    const timing = rows.findIndex((row) => row.includes(" --> "));
    if (timing < 0) continue;
    const [start = "", end = ""] = (rows[timing] ?? "").split(" --> ");
    const startSeconds = seconds(start);
    const endSeconds = seconds(end.split(/\s/)[0] ?? "");
    if (endSeconds <= startSeconds || (previous && startSeconds < previous.start))
      throw new Error("Invalid VTT timestamp");
    const cueRows = rows
      .slice(timing + 1)
      .map(cleanText)
      .filter(Boolean);
    let overlap = 0;
    if (rolling && previous && startSeconds <= previous.end) {
      for (let count = 1; count <= Math.min(previous.rows.length, cueRows.length); count++) {
        if (previous.rows.slice(-count).join("\n") === cueRows.slice(0, count).join("\n")) overlap = count;
      }
    }
    const text = cueRows.slice(overlap).join(" ");
    if (text) lines.push({ startSeconds, text });
    previous = { start: startSeconds, end: endSeconds, rows: cueRows };
  }
  return lines;
}

function seconds(timestamp: string): number {
  if (!/^(?:\d{2,}:)?[0-5]\d:[0-5]\d\.\d{3}$/.test(timestamp)) throw new Error("Invalid VTT timestamp");
  return timestamp.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

function cleanText(text: string): string {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match: string, entity: string) => {
      if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? match;
      const point = entity[1]?.toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return point <= 0x10ffff ? String.fromCodePoint(point) : match;
    })
    .replace(/\s+/g, " ")
    .trim();
}
