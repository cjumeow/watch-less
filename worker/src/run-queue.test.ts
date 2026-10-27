import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { FAKE_REASONS, FAKE_SECTIONS, fakeNotifier, fakeSteps, type FakeVideo } from "./fakes.js";
import { runQueue } from "./run-queue.js";

let dataFolder: string;

beforeEach(async () => {
  dataFolder = await mkdtemp(join(tmpdir(), "yt-digest-worker-"));
});

afterEach(async () => {
  await rm(dataFolder, { recursive: true, force: true });
});

async function queue(
  videoId: string,
  title: string,
  requestedAt = "2026-10-25T08:00:00.000Z",
  settings: { language?: string; model?: string; destination?: string; notionFolderPage?: string } = {},
) {
  await mkdir(join(dataFolder, "queue"), { recursive: true });
  await writeFile(
    join(dataFolder, "queue", `${videoId}.json`),
    JSON.stringify({ videoId, title, requestedAt, ...settings }),
  );
}

async function list(folder: string): Promise<string[]> {
  return readdir(join(dataFolder, folder)).catch(() => []);
}

async function run(videos: Record<string, FakeVideo> = {}) {
  const steps = fakeSteps(videos);
  const notifier = fakeNotifier();
  await runQueue({ dataFolder, steps, notifier, timeZone: "Asia/Taipei" });
  return { steps, notifier };
}

describe("runQueue", () => {
  test("turns a queued request into a delivered digest in the done folder, and says it is ready", async () => {
    await queue("aB3_x-9Zq0Y", "A made-up title from the card");

    const { steps, notifier } = await run({ "aB3_x-9Zq0Y": { details: { title: "A made-up video" } } });

    const done = await readFile(join(dataFolder, "done", "aB3_x-9Zq0Y.md"), "utf8");
    expect(done).toBe(
      [
        "# A made-up video",
        "",
        "https://www.youtube.com/watch?v=aB3_x-9Zq0Y",
        "",
        "- Channel: [A made-up channel](https://www.youtube.com/@made-up-channel)",
        "- Length: 12:34",
        "- Added: 2026-10-25 16:00",
        "- Model: claude-haiku-5-5",
        "",
        FAKE_SECTIONS,
      ].join("\n"),
    );
    expect(steps.delivered).toEqual([
      { destination: "heptabase", videoLink: "https://www.youtube.com/watch?v=aB3_x-9Zq0Y", markdown: done },
    ]);
    expect(await list("queue")).toEqual([]);
    expect(await list("drafts")).toEqual([]);
    expect(notifier.sent).toEqual(["Digest ready: A made-up video"]);
    expect(notifier.links).toEqual(["https://example.invalid/aB3_x-9Zq0Y"]);
  });

  test("writes the digest in English with Haiku when the queue file does not say", async () => {
    await queue("aB3_x-9Zq0Y", "A made-up video");

    const { steps } = await run();

    expect(steps.settings).toEqual([{ language: "en", model: "claude-haiku-5-5" }]);
  });

  test("writes the digest in the queue file's language with its model, and the header names the model", async () => {
    await queue("aB3_x-9Zq0Y", "A made-up video", undefined, { language: "zh-Hant", model: "claude-sonnet-5-5" });

    const { steps } = await run();

    expect(steps.settings).toEqual([{ language: "zh-Hant", model: "claude-sonnet-5-5" }]);
    expect(await readFile(join(dataFolder, "done", "aB3_x-9Zq0Y.md"), "utf8")).toContain(
      "\n- Model: claude-sonnet-5-5\n",
    );
  });

  test("delivers to the queue file's destination, with its folder page", async () => {
    const notionFolderPage = "0123456789abcdef0123456789abcdef";
    await queue("aB3_x-9Zq0Y", "A made-up video", undefined, { destination: "notion", notionFolderPage });

    const { steps } = await run();

    expect(steps.delivered).toEqual([expect.objectContaining({ destination: "notion", notionFolderPage })]);
  });

  test("delivers to Notion without a folder page when the queue file has none", async () => {
    await queue("aB3_x-9Zq0Y", "A made-up video", undefined, { destination: "notion" });

    const { steps } = await run();

    expect(steps.delivered).toHaveLength(1);
    expect(steps.delivered[0]).toMatchObject({ destination: "notion" });
    expect(steps.delivered[0]).not.toHaveProperty("notionFolderPage");
  });

  test("writes the digest with an OpenAI model when the queue file asks for one", async () => {
    await queue("aB3_x-9Zq0Y", "A made-up video", undefined, { model: "gpt-6-luna" });

    const { steps } = await run();

    expect(steps.settings).toEqual([{ language: "en", model: "gpt-6-luna" }]);
    expect(await readFile(join(dataFolder, "done", "aB3_x-9Zq0Y.md"), "utf8")).toContain("\n- Model: gpt-6-luna\n");
  });

  test("links a time range the model left without its link", async () => {
    await queue("aB3_x-9Zq0Y", "A made-up video");

    await run({ "aB3_x-9Zq0Y": { sections: `${FAKE_SECTIONS}\n- [0:07–0:30] **A made-up point**: Made-up words.\n` } });

    expect(await readFile(join(dataFolder, "done", "aB3_x-9Zq0Y.md"), "utf8")).toContain(
      "- [0:07–0:30](https://www.youtube.com/watch?v=aB3_x-9Zq0Y&t=7s) **A made-up point**",
    );
  });

  test("takes the oldest request first", async () => {
    await queue("aaaaaaaaaaa", "A made-up newer video", "2026-10-25T09:00:00.000Z");
    await queue("zzzzzzzzzzz", "A made-up older video", "2026-10-25T08:00:00.000Z");

    const { steps } = await run();

    expect(steps.calls.filter((call) => call.startsWith("check"))).toEqual(["check zzzzzzzzzzz", "check aaaaaaaaaaa"]);
  });

  test("removes a request whose video is already done, without a step or a notification", async () => {
    await mkdir(join(dataFolder, "done"), { recursive: true });
    await writeFile(join(dataFolder, "done", "aB3_x-9Zq0Y.md"), "A made-up earlier digest");
    await queue("aB3_x-9Zq0Y", "A made-up video");

    const { steps, notifier } = await run();

    expect(await list("queue")).toEqual([]);
    expect(await readFile(join(dataFolder, "done", "aB3_x-9Zq0Y.md"), "utf8")).toBe("A made-up earlier digest");
    expect(steps.calls).toEqual([]);
    expect(notifier.sent).toEqual([]);
  });

  test.each([
    ["check", "A made-up title from the card"],
    ["transcript", "A made-up video"],
    ["model", "A made-up video"],
    ["delivery", "A made-up video"],
  ] as const)("removes a request that fails at the %s, logs it and says why", async (failsAt, title) => {
    await queue("aB3_x-9Zq0Y", "A made-up title from the card");
    await queue("zzzzzzzzzzz", "A made-up later video", "2026-10-25T09:00:00.000Z");

    const { notifier } = await run({ "aB3_x-9Zq0Y": { failsAt, details: { title: "A made-up video" } } });

    expect(await list("queue")).toEqual([]);
    expect(await list("drafts")).toEqual([]);
    expect(await list("done")).toEqual(["zzzzzzzzzzz.md"]);
    expect(notifier.sent).toEqual([
      `Digest failed: ${title}: ${FAKE_REASONS[failsAt]}`,
      "Digest ready: A made-up video",
    ]);
    const log = await readFile(join(dataFolder, "logs", "worker.log"), "utf8");
    expect(log).toMatch(new RegExp(`aB3_x-9Zq0Y failed: ${FAKE_REASONS[failsAt]}`));
  });

  test("leaves a postponed request queued with no notification, and stops until the worker's next start", async () => {
    await queue("aB3_x-9Zq0Y", "A made-up video");
    await queue("zzzzzzzzzzz", "A made-up later video", "2026-10-25T09:00:00.000Z");

    const { steps, notifier } = await run({ "aB3_x-9Zq0Y": { postponed: true } });

    expect(await list("queue")).toEqual(["aB3_x-9Zq0Y.json", "zzzzzzzzzzz.json"]);
    expect(await list("drafts")).toEqual([]);
    expect(await list("done")).toEqual([]);
    expect(steps.calls).not.toContain("check zzzzzzzzzzz");
    expect(notifier.sent).toEqual([]);
    const log = await readFile(join(dataFolder, "logs", "worker.log"), "utf8");
    expect(log).toMatch(/aB3_x-9Zq0Y postponed: the usage limit is reached/);
  });

  test("gives a reason that points to the log for an error no step expected", async () => {
    await queue("aB3_x-9Zq0Y", "A made-up video");

    const { notifier } = await run({ "aB3_x-9Zq0Y": { failsAt: "crash" } });

    expect(await list("queue")).toEqual([]);
    expect(notifier.sent).toEqual(["Digest failed: A made-up video: Unexpected error, see logs/worker.log"]);
    const log = await readFile(join(dataFolder, "logs", "worker.log"), "utf8");
    expect(log).toContain("A made-up crash");
  });

  test.each([
    ["not JSON", "{"],
    ["a request the shared parser refuses", JSON.stringify({ videoId: "aB3_x-9Zq0Y", title: "A made-up video" })],
    [
      "a request for another video than its name",
      JSON.stringify({ videoId: "zzzzzzzzzzz", title: "A made-up video", requestedAt: "2026-10-25T08:00:00.000Z" }),
    ],
  ])("removes a queue file that is %s, logs it and says so", async (_case, contents) => {
    await mkdir(join(dataFolder, "queue"), { recursive: true });
    await writeFile(join(dataFolder, "queue", "aB3_x-9Zq0Y.json"), contents);
    await queue("bbbbbbbbbbb", "A made-up later video", "2026-10-25T09:00:00.000Z");

    const { steps, notifier } = await run();

    expect(await list("queue")).toEqual([]);
    expect(steps.calls).not.toContain("check aB3_x-9Zq0Y");
    expect(notifier.sent).toEqual([
      "Digest failed: aB3_x-9Zq0Y: The request could not be read",
      "Digest ready: A made-up video",
    ]);
    const log = await readFile(join(dataFolder, "logs", "worker.log"), "utf8");
    expect(log).toMatch(/aB3_x-9Zq0Y failed: The request could not be read/);
  });

  test("leaves alone a file in the queue folder that is not named as a request", async () => {
    await mkdir(join(dataFolder, "queue"), { recursive: true });
    await writeFile(join(dataFolder, "queue", ".aB3_x-9Zq0Y.json.tmp"), "{");

    const { steps, notifier } = await run();

    expect(await list("queue")).toEqual([".aB3_x-9Zq0Y.json.tmp"]);
    expect(steps.calls).toEqual([]);
    expect(notifier.sent).toEqual([]);
  });

  test("uses the title from the card when YouTube gives none", async () => {
    await queue("aB3_x-9Zq0Y", "A made-up title from the card");

    const { notifier } = await run({ "aB3_x-9Zq0Y": { details: { title: "" } } });

    const done = await readFile(join(dataFolder, "done", "aB3_x-9Zq0Y.md"), "utf8");
    expect(done.split("\n")[0]).toBe("# A made-up title from the card");
    expect(notifier.sent).toEqual(["Digest ready: A made-up title from the card"]);
  });

  test("takes a request queued while another is being digested in the same run", async () => {
    await queue("aB3_x-9Zq0Y", "A made-up video");
    const steps = fakeSteps();
    const deliver = steps.destination.deliver.bind(steps.destination);
    steps.destination.deliver = async (digest) => {
      if (digest.videoLink.endsWith("aB3_x-9Zq0Y")) await queue("zzzzzzzzzzz", "A made-up later video");
      return deliver(digest);
    };

    await runQueue({ dataFolder, steps, notifier: fakeNotifier(), timeZone: "Asia/Taipei" });

    expect((await list("done")).sort()).toEqual(["aB3_x-9Zq0Y.md", "zzzzzzzzzzz.md"]);
  });

  test("keeps a new request for the same video that arrives while it is being digested", async () => {
    await queue("aB3_x-9Zq0Y", "A made-up video");
    const steps = fakeSteps();
    const deliver = steps.destination.deliver.bind(steps.destination);
    steps.destination.deliver = async (digest) => {
      await queue("aB3_x-9Zq0Y", "A made-up video", "2026-10-25T08:05:00.000Z");
      return deliver(digest);
    };

    await runQueue({ dataFolder, steps, notifier: fakeNotifier(), timeZone: "Asia/Taipei" });

    // The new request is not lost: the next pass finds the digest done and removes it as a repeated request.
    const log = await readFile(join(dataFolder, "logs", "worker.log"), "utf8");
    expect(log).toMatch(/aB3_x-9Zq0Y skipped: already done/);
  });
});
