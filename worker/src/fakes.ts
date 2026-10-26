// Fake steps and a fake notifier that stand in for yt-dlp, `claude -p`, Heptabase and macOS, so the loop runs on
// made-up videos in tests and checks, on any computer.

import { DigestFailure } from "./digest-failure.js";
import type { Digest, Destination } from "./destination/destination.js";
import type { DigestInput, ModelAnswer, ModelStep } from "./model/model-step.js";
import type { Notifier } from "./notifier.js";
import type { Steps } from "./run-queue.js";
import type { Transcript, TranscriptStep, VideoDetails } from "./transcript/transcript-step.js";

/** Which step a fake video fails at, if any. */
export type FakeFailure = "check" | "transcript" | "model" | "delivery" | "crash";

/** A made-up video, and how each fake step treats it. Every field has a default. */
export interface FakeVideo {
  details?: Partial<VideoDetails>;
  /** The step that throws a `DigestFailure`; `crash` throws a plain error from the model step instead. */
  failsAt?: FakeFailure;
  /** The model meets the usage limit. */
  postponed?: boolean;
  /** What the model writes, `FAKE_SECTIONS` by default. */
  sections?: string;
}

export const FAKE_SECTIONS = "## Conclusion\n\nA made-up conclusion.\n\n## Main arguments\n\n## References\n";
export const FAKE_TRANSCRIPT: Transcript = {
  source: "subtitles",
  lines: [
    { startSeconds: 0, text: "Made-up words." },
    { startSeconds: 7, text: "More made-up words." },
  ],
};

/** The reason each fake failure gives, for the notification. */
export const FAKE_REASONS: Record<Exclude<FakeFailure, "crash">, string> = {
  check: "The video is private",
  transcript: "No transcript available",
  model: "The digest was incomplete",
  delivery: "Heptabase could not be reached",
};

export interface FakeSteps extends Steps {
  /** What each step was called with, in order, as `<step> <videoId>`. */
  calls: string[];
  /** The language and model the model step was given, one entry per call. */
  settings: Pick<DigestInput, "language" | "model">[];
  delivered: Digest[];
}

/** Steps that look each video up in `videos`; a video missing from it is an ordinary one that succeeds. */
export function fakeSteps(videos: Record<string, FakeVideo> = {}): FakeSteps {
  const calls: string[] = [];
  const settings: FakeSteps["settings"] = [];
  const delivered: Digest[] = [];
  const failIf = (video: FakeVideo, step: Exclude<FakeFailure, "crash">) => {
    if (video.failsAt === step) throw new DigestFailure(FAKE_REASONS[step]);
  };

  const transcript: TranscriptStep = {
    checkVideo(videoId) {
      calls.push(`check ${videoId}`);
      const video = videos[videoId] ?? {};
      failIf(video, "check");
      const details = {
        title: "A made-up video",
        channel: "A made-up channel",
        channelUrl: "https://www.youtube.com/@made-up-channel",
        durationSeconds: 754,
        description: "A made-up description.",
        ...video.details,
      };
      return Promise.resolve({
        details,
        getTranscript() {
          calls.push(`transcript ${videoId}`);
          failIf(video, "transcript");
          return Promise.resolve(FAKE_TRANSCRIPT);
        },
      });
    },
  };

  const model: ModelStep = {
    writeDigest(input): Promise<ModelAnswer> {
      const { videoId } = input;
      calls.push(`model ${videoId}`);
      settings.push({ language: input.language, model: input.model });
      const video = videos[videoId] ?? {};
      if (video.failsAt === "crash") throw new Error("A made-up crash");
      failIf(video, "model");
      if (video.postponed === true) return Promise.resolve({ outcome: "postponed" });
      return Promise.resolve({ outcome: "written", sections: video.sections ?? FAKE_SECTIONS, model: input.model });
    },
  };

  const destination: Destination = {
    deliver(digest) {
      const videoId = new URL(digest.videoLink).searchParams.get("v") ?? "";
      calls.push(`deliver ${videoId}`);
      failIf(videos[videoId] ?? {}, "delivery");
      delivered.push(digest);
      return Promise.resolve();
    },
  };

  return { transcript, model, destination, calls, settings, delivered };
}

export interface FakeNotifier extends Notifier {
  /** Each notification sent, as `<title>: <text>`. */
  sent: string[];
}

export function fakeNotifier(): FakeNotifier {
  const sent: string[] = [];
  return {
    sent,
    notify(title, text) {
      sent.push(`${title}: ${text}`);
      return Promise.resolve();
    },
  };
}
