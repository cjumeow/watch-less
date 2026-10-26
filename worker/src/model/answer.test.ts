import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import { readModelAnswer } from "./answer.js";
import { HEADINGS } from "./languages.js";

const english = { headings: HEADINGS.en, model: "claude-made-up" };

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

test("reads a successful CLI result as the digest's three sections", async () => {
  const answer = readModelAnswer(await fixture("written.json"), 0, english);
  expect(answer).toMatchObject({ outcome: "written", model: "claude-made-up" });
  if (answer.outcome !== "written") throw new Error("Expected a written digest");
  expect(answer.sections).toBe(
    "## Conclusion\n\nA made-up summary.\n\n## Main arguments\n\n- The speaker compares two made-up plans.\n\n## References\n\nThe video cites no references.",
  );
});

test("fails an answer with a missing section heading", async () => {
  const output = await fixture("incomplete.json");
  expect(() => readModelAnswer(output, 0, english)).toThrow("The digest was incomplete");
});

test("fails an answer that still uses an old Traditional Chinese heading", async () => {
  const output = (await fixture("written.json")).replace("## References", "## 參考資料");
  expect(() => readModelAnswer(output, 0, english)).toThrow("The digest was incomplete");
});

test("postpones only a known usage-limit error from the CLI", async () => {
  expect(readModelAnswer(await fixture("usage-limit.json"), 1, english)).toEqual({ outcome: "postponed" });
});

test("rejects a nonzero exit even when stdout looks like a complete digest", async () => {
  const output = await fixture("written.json");
  expect(() => readModelAnswer(output, 1, english)).toThrow("The model failed to write a digest");
});

test("turns malformed output into a model failure with the parse error preserved", () => {
  expect(() => readModelAnswer("not JSON", 0, english)).toThrow("The model failed to write a digest");
});

test("fails an unknown CLI error instead of guessing that it is a usage limit", async () => {
  const output = await fixture("unknown-error.json");
  expect(() => readModelAnswer(output, 1, english)).toThrow("The model failed to write a digest");
});

test("recognizes the observed plain-text limit even when the CLI exits zero", async () => {
  const output = await fixture("usage-limit.txt");
  expect(readModelAnswer(output, 1, english)).toEqual({ outcome: "postponed" });
  expect(readModelAnswer(output, 0, english)).toEqual({ outcome: "postponed" });
});

test("does not treat a digest quoting the limit message as a postponed request", async () => {
  const output = JSON.parse(await fixture("written.json")) as { result: string };
  output.result += "\n\nYou've hit your session limit · resets 3:50pm (Asia/Taipei)";
  expect(readModelAnswer(JSON.stringify(output), 0, english)).toMatchObject({ outcome: "written" });
});

test("checks the headings of the language asked for", async () => {
  const output = await fixture("written.json");
  expect(() => readModelAnswer(output, 0, { headings: HEADINGS["zh-Hant"], model: "claude-made-up" })).toThrow(
    "The digest was incomplete",
  );
});
