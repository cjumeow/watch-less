import { access, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseQueueFile, type QueueFile } from "@yt-digest/shared";
import { DigestFailure } from "./digest-failure.js";
import type { Destination } from "./destination/destination.js";
import { formatHeader, videoLink } from "./header.js";
import { fileLog, type Log } from "./log.js";
import { DEFAULT_SETTINGS } from "./model/languages.js";
import type { ModelStep } from "./model/model-step.js";
import type { NotificationTitle, Notifier } from "./notifier.js";
import type { TranscriptStep } from "./transcript/transcript-step.js";

/** The steps a request goes through, each replaceable. */
export interface Steps {
  transcript: TranscriptStep;
  model: ModelStep;
  destination: Destination;
}

export interface RunQueueOptions {
  /** Holds `queue/`, `drafts/`, `done/` and `logs/worker.log`. */
  dataFolder: string;
  steps: Steps;
  notifier: Notifier;
  /** The zone the header's requested time is written in; this Mac's own when left out. */
  timeZone?: string;
}

/** The reason a notification gives for an error no step expected; the details are in the log. */
const UNEXPECTED_REASON = "Unexpected error, see logs/worker.log";
const UNREADABLE_REASON = "The request could not be read";

/** The native host names a request `<videoId>.json`; anything else in the queue folder, such as its temporary file, is not one. */
const QUEUE_FILE_NAME = /^([A-Za-z0-9_-]{11})\.json$/;

interface Run extends RunQueueOptions {
  folders: { queue: string; drafts: string; done: string };
  log: Log;
}

/**
 * Turns every queued request into a digest, one at a time and oldest first, and resolves when the queue is empty or a
 * digest is postponed. A request that fails is removed and reported, and the run goes on with the next one.
 */
export async function runQueue(options: RunQueueOptions): Promise<void> {
  const { dataFolder } = options;
  const run: Run = {
    ...options,
    folders: { queue: join(dataFolder, "queue"), drafts: join(dataFolder, "drafts"), done: join(dataFolder, "done") },
    log: fileLog(join(dataFolder, "logs", "worker.log")),
  };
  await mkdir(run.folders.drafts, { recursive: true });
  await mkdir(run.folders.done, { recursive: true });

  // The queue is read again after each request, so one queued meanwhile is not missed.
  for (;;) {
    const { requests, unreadable } = await readQueue(run.folders.queue);
    for (const { queueFile, videoId, error } of unreadable) {
      await rm(queueFile, { force: true });
      await run.log(videoId, `failed: ${UNREADABLE_REASON}`, error);
      await notify(run, videoId, "Digest failed", `${videoId}: ${UNREADABLE_REASON}`);
    }
    const oldest = requests[0];
    if (oldest === undefined) return;
    if ((await digest(run, oldest.queueFile, oldest.request)) === "postponed") return;
  }
}

/** Takes one request through the steps; whatever happens, the request is no longer queued unless it is postponed. */
async function digest(run: Run, queueFile: string, request: QueueFile): Promise<"finished" | "postponed"> {
  const { folders, steps, log } = run;
  const { videoId } = request;
  const doneFile = join(folders.done, `${videoId}.md`);
  const draft = join(folders.drafts, `${videoId}.md`);

  if (await exists(doneFile)) {
    await removeRequest(queueFile, request);
    await log(videoId, "skipped: already done");
    return "finished";
  }

  // Until the video is checked, its title is the one the extension scraped from the card.
  let title = request.title;
  let postponed = false;
  try {
    const video = await steps.transcript.checkVideo(videoId);
    title = video.details.title || request.title;
    const transcript = await video.getTranscript();
    const answer = await steps.model.writeDigest({
      videoId,
      title,
      description: video.details.description,
      transcript,
      ...DEFAULT_SETTINGS,
    });
    if (answer.outcome === "postponed") {
      postponed = true;
    } else {
      const header = formatHeader(
        {
          videoId,
          title,
          channel: video.details.channel,
          channelUrl: video.details.channelUrl,
          durationSeconds: video.details.durationSeconds,
          requestedAt: request.requestedAt,
          model: answer.model,
        },
        run.timeZone,
      );
      const markdown = `${header}\n${answer.sections}`;
      // Written aside and moved into the done folder only once delivered, so an interrupted digest never counts as done.
      await writeFile(draft, markdown);
      await steps.destination.deliver({ videoLink: videoLink(videoId), markdown });
      await rename(draft, doneFile);
    }
  } catch (error) {
    const reason = error instanceof DigestFailure ? error.reason : UNEXPECTED_REASON;
    await removeRequest(queueFile, request);
    await rm(draft, { force: true });
    await log(videoId, `failed: ${reason}`, error);
    await notify(run, videoId, "Digest failed", `${title}: ${reason}`);
    return "finished";
  }

  if (postponed) {
    // Every later request would meet the same limit, so the run ends here and launchd's next start tries again.
    await log(videoId, "postponed: the usage limit is reached");
    return "postponed";
  }
  await removeRequest(queueFile, request);
  await log(videoId, "done");
  await notify(run, videoId, "Digest ready", title);
  return "finished";
}

/** A notification that cannot be shown is logged, never a reason to stop the run. */
async function notify(run: Run, videoId: string, title: NotificationTitle, text: string): Promise<void> {
  try {
    await run.notifier.notify(title, text);
  } catch (error) {
    await run.log(videoId, `notification not shown: ${title}`, error);
  }
}

interface QueuedRequest {
  queueFile: string;
  request: QueueFile;
}

interface UnreadableRequest {
  queueFile: string;
  videoId: string;
  error: unknown;
}

/** The requests in the queue folder, oldest first, and the files named as requests that do not hold one. */
async function readQueue(queueFolder: string): Promise<{ requests: QueuedRequest[]; unreadable: UnreadableRequest[] }> {
  const requests: QueuedRequest[] = [];
  const unreadable: UnreadableRequest[] = [];
  const names = await readdir(queueFolder).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  });
  for (const name of names) {
    const videoId = QUEUE_FILE_NAME.exec(name)?.[1];
    if (videoId === undefined) continue;
    const queueFile = join(queueFolder, name);
    try {
      const parsed = parseQueueFile(JSON.parse(await readFile(queueFile, "utf8")));
      if (!parsed.parsed) throw new Error(parsed.reason);
      if (parsed.value.videoId !== videoId) throw new Error(`the file holds a request for ${parsed.value.videoId}`);
      requests.push({ queueFile, request: parsed.value });
    } catch (error) {
      unreadable.push({ queueFile, videoId, error });
    }
  }
  // requestedAt is always in the form toISOString writes, so its text sorts as its time does.
  requests.sort(
    (a, b) =>
      a.request.requestedAt.localeCompare(b.request.requestedAt) || a.request.videoId.localeCompare(b.request.videoId),
  );
  return { requests, unreadable };
}

/**
 * Removes the request that was taken, and not one the native host wrote for the same video meanwhile: that one stays
 * queued, and the next pass finds the video done, or retries it after a failure.
 */
async function removeRequest(queueFile: string, request: QueueFile): Promise<void> {
  const current = await readFile(queueFile, "utf8").catch(() => undefined);
  if (current === undefined) return;
  let parsed;
  try {
    parsed = parseQueueFile(JSON.parse(current));
  } catch {
    // Not a request the host wrote whole; the next pass reports it as unreadable.
    return;
  }
  if (parsed.parsed && parsed.value.requestedAt !== request.requestedAt) return;
  await rm(queueFile, { force: true });
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}
