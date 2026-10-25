// The interface of the worker's first two steps: check the video, then get its transcript. The worker calls
// `checkVideo` and then, only for a video that passed, `getTranscript` on what it returned.

/** What the worker reads about a video without downloading it: what the digest's header shows, and its description. */
export interface VideoDetails {
  /** The title YouTube gives; empty when it gives none, and the worker then uses the queue file's. */
  title: string;
  channel: string;
  /** As yt-dlp reports it; the header rounds it to whole seconds. */
  durationSeconds: number;
  /** The text under the video, as its uploader wrote it, links included; empty when it has none. Untrusted, like the transcript. */
  description: string;
}

/** Where a transcript came from, the first of these that has one. */
export type TranscriptSource = "subtitles" | "automatic-captions" | "whisper";

/** The words said from one moment of the video. */
export interface TranscriptLine {
  startSeconds: number;
  text: string;
}

export interface Transcript {
  source: TranscriptSource;
  /** In the order they are said. */
  lines: readonly TranscriptLine[];
}

/** A video that can be digested. It holds whatever the check read, so getting the transcript need not read it again. */
export interface CheckedVideo {
  details: VideoDetails;
  /** Throws a `DigestFailure` when no source has a transcript. */
  getTranscript(): Promise<Transcript>;
}

export interface TranscriptStep {
  /**
   * Reads the video's details. Throws a `DigestFailure` with the reason when the video cannot be digested: live or an
   * unaired premiere, private, members-only, age-restricted, or longer than one hour.
   */
  checkVideo(videoId: string): Promise<CheckedVideo>;
}
