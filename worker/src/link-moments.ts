// The model sometimes writes a moment of the video, or a main argument's time range, without the link the prompt asks
// for. The worker adds it, the same way the prompt describes: the video's link and `&t=<seconds>s` of the start.

/** A moment or a range in brackets, `[m:ss]`, `[h:mm:ss]` or `[m:ss–m:ss]`, with no link after it. */
const BARE_MOMENT = /\[((?:\d+:)?\d{1,2}:[0-5]\d)(?:\s*[–-]\s*(?:\d+:)?\d{1,2}:[0-5]\d)?\](?!\()/g;

/** `sections` with each bare moment and time range linked to its start in the video at `videoLink`. */
export function linkMoments(sections: string, videoLink: string): string {
  // Inline code is text the model quotes, not a moment to link: only the parts between backticks are changed.
  return sections
    .split("`")
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part.replace(BARE_MOMENT, (moment, start: string) => `${moment}(${videoLink}&t=${String(seconds(start))}s)`),
    )
    .join("`");
}

function seconds(moment: string): number {
  return moment.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}
